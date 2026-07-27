/** Queue job type + payload for sending a password-reset email. */
export const PASSWORD_RESET_EMAIL_JOB = 'password-reset-email';

export interface PasswordResetEmailPayload {
  email: string;
  resetToken: string;
  recipientName?: string | null;
  expiresAt: string | Date;
}
