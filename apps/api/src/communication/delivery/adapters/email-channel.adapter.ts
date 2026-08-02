import { Injectable } from '@nestjs/common';
import { EmailService } from '../../../common/email/email.service';
import type {
  AdapterSendResult,
  ChannelAdapter,
  OutboundMessage,
} from '../delivery.types';

/**
 * Email channel adapter — delegates to the existing EmailService (SMTP/SendGrid/
 * log transports), so F5 reuses the configured email transport instead of
 * duplicating it. The DeliveryAttempt ledger is what F5 adds on top: EmailService
 * has no cost/consent/evidence layer of its own.
 */
@Injectable()
export class EmailChannelAdapter implements ChannelAdapter {
  readonly channel = 'email' as const;
  readonly provider = 'email';

  constructor(private readonly email: EmailService) {}

  async send(message: OutboundMessage): Promise<AdapterSendResult> {
    const body = message.body;
    await this.email.send({
      to: message.destination,
      subject: message.subject ?? '',
      html: body,
      text: stripHtml(body),
    });
    return {
      provider: this.email.isConfigured ? 'email' : 'log',
      providerMessageId: `email-${message.idempotencyKey}`,
      status: 'sent',
    };
  }
}

/** Minimal plain-text fallback for the text/plain MIME part. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
