import { Logger } from '@nestjs/common';
import type { EmailAddress, EmailMessage, EmailProvider } from '../email.types';

/**
 * Development / fallback provider.
 *
 * Does not send anything — it logs a compact record of the message (including
 * the subject and, for invitations, the accept link is in the body) so local
 * flows work without an email account. Selected when `EMAIL_PROVIDER` is unset
 * or `log`. Never use in production (EmailService warns when it is).
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';
  private readonly logger = new Logger('EmailProvider:log');

  send(message: EmailMessage, from: EmailAddress): Promise<void> {
    this.logger.log(
      `[email:log] from="${from.name ?? ''} <${from.email}>" to="${message.to}" subject="${message.subject}"\n${message.text}`,
    );
    return Promise.resolve();
  }
}
