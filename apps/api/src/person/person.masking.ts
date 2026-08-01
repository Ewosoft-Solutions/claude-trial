/**
 * Contact masking (privacy-by-default, AGENTS.md golden rule 7).
 *
 * A caller without `people.view_contact` sees a masked ContactPoint value; the
 * unmasked value requires the higher-clearance permission. Masking is a READ
 * concern — the row is stored in full (and the normalized value is indexed for
 * dedup), but it is redacted on the way out unless the caller is authorized.
 */

/** Normalize a contact value for dedup/lookup (lowercased email, digits-only phone). */
export function normalizeContact(kind: string, value: string): string {
  const trimmed = value.trim();
  if (kind === 'email') return trimmed.toLowerCase();
  if (kind === 'phone') {
    const digits = trimmed.replace(/[^\d+]/g, '');
    return digits;
  }
  return trimmed.toLowerCase();
}

/** Mask an email as `a***@e***.com`, keeping only enough to recognize it. */
function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at <= 0) return maskGeneric(value);
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 ? domain.slice(dot) : '';
  const domainName = dot >= 0 ? domain.slice(0, dot) : domain;
  return `${local[0]}***@${domainName[0] ?? ''}***${tld}`;
}

/** Mask a phone keeping the last two digits, e.g. `*******89`. */
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return '**';
  return `${'*'.repeat(digits.length - 2)}${digits.slice(-2)}`;
}

function maskGeneric(value: string): string {
  if (value.length <= 2) return '**';
  return `${value[0]}***${value.slice(-1)}`;
}

export function maskContactValue(kind: string, value: string): string {
  if (kind === 'email') return maskEmail(value);
  if (kind === 'phone') return maskPhone(value);
  return maskGeneric(value);
}
