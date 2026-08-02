import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobHandlerRegistry } from '../../../common/jobs/job-handler.registry';
import type { JobContext } from '../../../common/jobs/job.types';
import { DeliveryAdapterRegistry } from '../adapters/delivery-adapter.registry';
import { DELIVERY_SEND_JOB, type DeliverySendPayload } from '../delivery.jobs';
import type { DeliveryChannel } from '../delivery.types';

/**
 * Registers the durable delivery-send handler (F5 on F3). The handler runs in
 * the job's own tenant scope (ctx.client) so its ledger write is RLS-correct and
 * commits exactly-once with the job completion.
 *
 * Idempotency / no-double-send: the handler is a NO-OP if the attempt is already
 * sent/delivered (a retry after a completed run does nothing), and the adapter
 * receives the attempt id as a provider-side idempotency key so a provider whose
 * ack timed out is not asked to transmit twice. On a provider error the handler
 * throws → F3 requeues with backoff (the ledger stays `queued`) until success or
 * the terminal dead state.
 */
@Injectable()
export class DeliveryJobRegistrar implements OnModuleInit {
  private readonly logger = new Logger(DeliveryJobRegistrar.name);

  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly adapters: DeliveryAdapterRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register<DeliverySendPayload>(DELIVERY_SEND_JOB, (p, ctx) =>
      this.send(p, ctx),
    );
  }

  private async send(
    payload: DeliverySendPayload,
    ctx: JobContext,
  ): Promise<void> {
    const attempt = await ctx.client.deliveryAttempt.findFirst({
      where: { id: payload.attemptId },
    });
    if (!attempt) {
      this.logger.warn(`delivery.send: attempt ${payload.attemptId} gone`);
      return;
    }
    // Already delivered on a prior run → do not send again.
    if (attempt.status === 'sent' || attempt.status === 'delivered') {
      return;
    }

    const adapter = this.adapters.get(attempt.channel as DeliveryChannel);
    const result = await adapter.send({
      channel: attempt.channel as DeliveryChannel,
      destination: payload.destination,
      subject: payload.subject,
      body: payload.body,
      idempotencyKey: attempt.id,
      from: payload.from,
    });

    const now = new Date();
    await ctx.client.deliveryAttempt.update({
      where: { id: attempt.id },
      data: {
        status: result.status,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        sentAt: now,
        deliveredAt: result.status === 'delivered' ? now : null,
        error: null,
        failureClass: null,
      },
    });
  }
}
