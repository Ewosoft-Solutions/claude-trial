import { Injectable, Logger } from '@nestjs/common';
import type {
  AdapterSendResult,
  ChannelAdapter,
  OutboundMessage,
} from '../delivery.types';
import { redactDestination } from '../redact';

/**
 * Dev/default SMS adapter: logs a redacted line and reports success, so local
 * and CI flows exercise the full delivery path without a real gateway. A real
 * provider adapter (Termii/Twilio/etc.) implements the same ChannelAdapter and
 * is swapped in by SMS_PROVIDER without touching any producer.
 */
@Injectable()
export class LogSmsAdapter implements ChannelAdapter {
  readonly channel = 'sms' as const;
  readonly provider = 'log';
  private readonly logger = new Logger(LogSmsAdapter.name);

  async send(message: OutboundMessage): Promise<AdapterSendResult> {
    this.logger.log(
      `[sms:log] → ${redactDestination('sms', message.destination)} (${message.body.length} chars)`,
    );
    return {
      provider: this.provider,
      providerMessageId: `log-sms-${message.idempotencyKey}`,
      status: 'sent',
    };
  }
}
