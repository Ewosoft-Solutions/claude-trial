import type { EmailMessage } from '../email.types';

export interface InvitationEmailInput {
  to: string;
  recipientName?: string | null;
  tenantName: string;
  roleName?: string | null;
  acceptUrl: string;
  expiresAt?: Date | string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Compose the "you've been invited" email (subject + HTML + text).
 * Self-contained inline HTML so it renders without external assets.
 */
export function buildInvitationEmail(input: InvitationEmailInput): EmailMessage {
  const greetingName = input.recipientName?.trim();
  const roleClause = input.roleName ? ` as ${escapeHtml(input.roleName)}` : '';
  const expires = input.expiresAt ? new Date(input.expiresAt) : null;
  const expiresLine =
    expires && !Number.isNaN(expires.getTime())
      ? `This invitation expires on ${expires.toUTCString()}.`
      : '';

  const subject = `You're invited to join ${input.tenantName} on SchoolWithEase`;

  const text = [
    `Hi${greetingName ? ` ${greetingName}` : ''},`,
    '',
    `You've been invited to join ${input.tenantName}${input.roleName ? ` as ${input.roleName}` : ''} on SchoolWithEase.`,
    '',
    'Accept your invitation and set a password:',
    input.acceptUrl,
    '',
    expiresLine,
    '',
    'If you weren’t expecting this, you can ignore this email.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h1 style="font-size:20px;margin:0 0 8px">You're invited to ${escapeHtml(input.tenantName)}</h1>
    <p style="font-size:14px;line-height:1.5;color:#334155">
      Hi${greetingName ? ` ${escapeHtml(greetingName)}` : ''}, you've been invited to join
      <strong>${escapeHtml(input.tenantName)}</strong>${roleClause} on SchoolWithEase.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(input.acceptUrl)}"
         style="background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
        Accept invitation
      </a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#64748b">
      Or paste this link into your browser:<br>
      <a href="${escapeHtml(input.acceptUrl)}" style="color:#6366f1;word-break:break-all">${escapeHtml(input.acceptUrl)}</a>
    </p>
    ${expiresLine ? `<p style="font-size:12px;color:#64748b">${escapeHtml(expiresLine)}</p>` : ''}
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">
      If you weren’t expecting this, you can ignore this email.
    </p>
  </div>`.trim();

  return { to: input.to, subject, text, html };
}
