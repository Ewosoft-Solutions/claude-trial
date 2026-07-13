import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailAddress, EmailMessage, EmailProvider } from '../email.types';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

/**
 * SMTP provider (nodemailer). Works with any SMTP server — self-hosted,
 * Gmail/Workspace, Mailgun/SES SMTP, Postmark, etc. Selected when
 * `EMAIL_PROVIDER=smtp` and `SMTP_HOST` is set.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger('EmailProvider:smtp');
  private readonly transporter: Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.password
          ? { user: config.user, pass: config.password }
          : undefined,
    });
  }

  async send(message: EmailMessage, from: EmailAddress): Promise<void> {
    await this.transporter.sendMail({
      from: from.name ? { name: from.name, address: from.email } : from.email,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    this.logger.log(`Sent "${message.subject}" to ${message.to}`);
  }
}
