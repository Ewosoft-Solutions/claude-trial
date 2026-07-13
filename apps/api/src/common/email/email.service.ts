import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.config';
import type { EmailAddress, EmailMessage, EmailProvider } from './email.types';
import { LogEmailProvider } from './providers/log-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { SendGridEmailProvider } from './providers/sendgrid-email.provider';

/**
 * Email Service
 *
 * Single entry point for outbound email. Resolves the transport once from
 * `EMAIL_PROVIDER` (+ its credentials) and delegates `send()` to it. Falls back
 * to the log provider when nothing is configured so local/dev flows keep
 * working; warns loudly if that fallback is hit in production.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly config: EnvConfig;
  private provider: EmailProvider | null = null;
  private readonly from: EmailAddress;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<EnvConfig>('env', { infer: true });
    this.from = {
      email: this.config.SMTP_FROM_EMAIL || 'no-reply@schoolwithease.local',
      name: this.config.SMTP_FROM_NAME || 'SchoolWithEase',
    };
  }

  /** Whether a real transport is configured (i.e. not the log fallback). */
  get isConfigured(): boolean {
    return this.resolve().name !== 'log';
  }

  async send(message: EmailMessage): Promise<void> {
    await this.resolve().send(message, this.from);
  }

  /** Resolve (and memoise) the provider from config. */
  private resolve(): EmailProvider {
    if (this.provider) return this.provider;

    const choice = (this.config.EMAIL_PROVIDER || '').toLowerCase();

    if (choice === 'smtp' && this.config.SMTP_HOST) {
      this.provider = new SmtpEmailProvider({
        host: this.config.SMTP_HOST,
        port: this.config.SMTP_PORT ?? 587,
        secure: this.config.SMTP_SECURE,
        user: this.config.SMTP_USER,
        password: this.config.SMTP_PASSWORD,
      });
    } else if (choice === 'sendgrid' && this.config.SENDGRID_API_KEY) {
      this.provider = new SendGridEmailProvider(this.config.SENDGRID_API_KEY);
    } else {
      if (this.config.NODE_ENV === 'production') {
        this.logger.warn(
          'No email provider configured (EMAIL_PROVIDER). Falling back to the log provider — emails are NOT being delivered.',
        );
      } else {
        this.logger.log(
          'Using log email provider (set EMAIL_PROVIDER=smtp|sendgrid to deliver real email).',
        );
      }
      this.provider = new LogEmailProvider();
    }

    return this.provider;
  }
}
