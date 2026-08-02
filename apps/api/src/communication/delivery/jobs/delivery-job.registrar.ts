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
 * rethrows so F3 retries with backoff (the ledger stays `queued`); on the final
 * exhausted attempt it records the failure on the DeliveryAttempt (`failed` +
 * `provider_error` + error) and returns — the ledger, not the job row, is the
 * delivery source of truth.
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
    const now = new Date();

    try {
      const result = await adapter.send({
        channel: attempt.channel as DeliveryChannel,
        destination: payload.destination,
        subject: payload.subject,
        body: payload.body,
        idempotencyKey: attempt.id,
        from: payload.from,
      });

      await ctx.client.deliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: result.status,
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          attemptNo: ctx.job.attempts,
          sentAt: now,
          deliveredAt: result.status === 'delivered' ? now : null,
          error: null,
          failureClass: null,
        },
      });
    } catch (err) {
      // A provider error must land ON THE LEDGER, not just the job row. Because
      // the handler + job completion share ONE tx, a rethrow rolls back any
      // write here — so record the failure only when retries are EXHAUSTED (this
      // is the terminal attempt), then return normally: the job "succeeded" at
      // recording a `failed` DeliveryAttempt (the ledger is the delivery source
      // of truth). Before that, rethrow so F3 retries with backoff.
      const message = err instanceof Error ? err.message : String(err);
      const terminal = ctx.job.attempts >= ctx.job.max_attempts;
      if (!terminal) throw err;

      this.logger.error(
        `delivery.send: attempt ${attempt.id} failed terminally after ${ctx.job.attempts} attempt(s): ${message}`,
      );
      await ctx.client.deliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'failed',
          failureClass: 'provider_error',
          error: message,
          attemptNo: ctx.job.attempts,
          failedAt: now,
        },
      });
    }
  }
}
