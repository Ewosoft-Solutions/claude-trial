import type { EmailMessage } from '../email.types';

export interface PasswordResetEmailInput {
  to: string;
  resetUrl: string;
  recipientName?: string | null;
  expiresAt?: Date | string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Compose the single-use password-reset email in HTML and plain text. */
export function buildPasswordResetEmail(
  input: PasswordResetEmailInput,
): EmailMessage {
  const recipientName = input.recipientName?.trim();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  const expiresLine =
    expiresAt && !Number.isNaN(expiresAt.getTime())
      ? `This link expires on ${expiresAt.toUTCString()}.`
      : 'This link expires in one hour.';

  const subject = 'Reset your SchoolWithEase password';
  const greeting = `Hi${recipientName ? ` ${recipientName}` : ''},`;
  const text = [
    greeting,
    '',
    'We received a request to reset your SchoolWithEase password.',
    '',
    'Choose a new password:',
    input.resetUrl,
    '',
    expiresLine,
    '',
    'If you didn’t request this, you can ignore this email. Your password will not change.',
  ].join('\n');

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h1 style="font-size:20px;margin:0 0 8px">Reset your password</h1>
    <p style="font-size:14px;line-height:1.5;color:#334155">
      ${escapeHtml(greeting)} We received a request to reset your SchoolWithEase password.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(input.resetUrl)}"
         style="background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
        Choose a new password
      </a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#64748b">
      Or paste this link into your browser:<br>
      <a href="${escapeHtml(input.resetUrl)}" style="color:#6366f1;word-break:break-all">${escapeHtml(input.resetUrl)}</a>
    </p>
    <p style="font-size:12px;color:#64748b">${escapeHtml(expiresLine)}</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">
      If you didn’t request this, you can ignore this email. Your password will not change.
    </p>
  </div>`.trim();

  return { to: input.to, subject, text, html };
}
