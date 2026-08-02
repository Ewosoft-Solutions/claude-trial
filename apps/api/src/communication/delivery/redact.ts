import type { DeliveryChannel } from './delivery.types';

/**
 * Redact a destination for the delivery ledger. The ledger records *that* a
 * message went to a masked address (audit/evidence) without persisting the raw
 * PII — the real destination lives only in the transient job payload.
 */
export function redactDestination(
  channel: DeliveryChannel,
  destination: string,
): string {
  const value = (destination ?? '').trim();
  if (!value) return '';
  if (channel === 'email' || value.includes('@')) {
    return maskEmail(value);
  }
  return maskPhone(value);
}

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return maskPhone(email);
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local[0] ?? '';
  return `${head}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length || 1);
  const last4 = digits.slice(-4);
  return `${'*'.repeat(digits.length - 4)}${last4}`;
}
