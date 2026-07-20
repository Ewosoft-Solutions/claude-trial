import { Logger } from '@nestjs/common';
import type { EmailAddress, EmailMessage, EmailProvider } from '../email.types';

/**
 * SendGrid provider via the v3 HTTP API (uses global fetch — no SDK dep).
 * Selected when `EMAIL_PROVIDER=sendgrid` and `SENDGRID_API_KEY` is set.
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private readonly logger = new Logger('EmailProvider:sendgrid');

  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage, from: EmailAddress): Promise<void> {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: from.email, name: from.name },
        subject: message.subject,
        content: [
          { type: 'text/plain', value: message.text },
          { type: 'text/html', value: message.html },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `SendGrid send failed (${res.status}): ${body.slice(0, 300)}`,
      );
    }
    this.logger.log(`Sent "${message.subject}" to ${message.to}`);
  }
}
