/**
 * Email port + message shape.
 *
 * `EmailProvider` is the seam every concrete transport (SMTP, SendGrid, a dev
 * logger) implements, so callers depend only on `EmailService.send()` and the
 * transport is swapped via the `EMAIL_PROVIDER` env var. Mirrors the
 * LlmProvider/StorageProvider port pattern used elsewhere in the codebase.
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text fallback; senders should always provide one. */
  text: string;
}

export interface EmailProvider {
  /** Stable identifier, e.g. 'smtp' | 'sendgrid' | 'log'. */
  readonly name: string;
  /**
   * Deliver a message. Implementations throw on failure so the caller (the
   * queue processor) can mark the job failed and retry/alert.
   */
  send(message: EmailMessage, from: EmailAddress): Promise<void>;
}
