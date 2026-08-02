import { Injectable, Logger } from '@nestjs/common';
import type {
  AdapterSendResult,
  ChannelAdapter,
  OutboundMessage,
} from '../delivery.types';
import { redactDestination } from '../redact';

/**
 * Dev/default push adapter (logs + succeeds). A real Web-Push/VAPID or FCM
 * adapter slots in behind the same seam (see ADR-14's device/push registry for
 * the future platform-notification path).
 */
@Injectable()
export class LogPushAdapter implements ChannelAdapter {
  readonly channel = 'push' as const;
  readonly provider = 'log';
  private readonly logger = new Logger(LogPushAdapter.name);

  async send(message: OutboundMessage): Promise<AdapterSendResult> {
    this.logger.log(
      `[push:log] → ${redactDestination('push', message.destination)}`,
    );
    return {
      provider: this.provider,
      providerMessageId: `log-push-${message.idempotencyKey}`,
      status: 'sent',
    };
  }
}
