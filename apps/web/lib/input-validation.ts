/**
 * Shared, framework-light input validators for the web.
 *
 * These give the USER instant, friendly feedback; the server (apps/api
 * class-validator DTOs) stays the authoritative gate — never trust the client.
 * Keep these rules in step with the server DTOs so the two agree.
 *
 * This is the seed module for the input-validation initiative
 * (docs/input-validation-plan.md): add a validator here per field TYPE, then
 * reuse it across every field of that type rather than re-deriving regexes.
 */

/** A single field's validation outcome. */
export interface FieldCheck {
  valid: boolean;
  /** A user-facing message when invalid (null when valid). */
  error: string | null;
}

const ok: FieldCheck = { valid: true, error: null };
const bad = (error: string): FieldCheck => ({ valid: false, error });

/** Count "signal" characters (letters or digits, any script). */
export function signalCount(value: string): number {
  return (value.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

/**
 * A free-text search box. We do not block typing, but a query is only worth
 * sending once it carries at least two letters/digits — so pure punctuation like
 * "??" is treated as "keep typing", not a real (empty) search.
 */
export function isSearchable(value: string): boolean {
  return signalCount(value.trim()) >= 2;
}

/** Letters (any script) + spaces and the punctuation real names use. */
const NAME_RE = /^[\p{L}][\p{L}\p{M}\s'.-]*$/u;

export function checkName(value: string, label = 'Name'): FieldCheck {
  const v = value.trim();
  if (!v) return bad(`${label} is required.`);
  if (v.length > 120) return bad(`${label} is too long.`);
  if (!NAME_RE.test(v)) {
    return bad(`${label} may only use letters, spaces, ' . and -.`);
  }
  return ok;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkEmail(value: string): FieldCheck {
  const v = value.trim();
  if (!v) return bad('Email is required.');
  if (!EMAIL_RE.test(v)) return bad('Enter a valid email address.');
  return ok;
}

/** Nigerian + international phone: digits with optional +, spaces, ( ), -. */
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

export function checkPhone(value: string): FieldCheck {
  const v = value.trim();
  if (!v) return bad('Phone is required.');
  if (!PHONE_RE.test(v) || signalCount(v) < 7) {
    return bad('Enter a valid phone number.');
  }
  return ok;
}

/** A bounded positive integer (e.g. a contact-priority rank). */
export function checkPositiveInt(
  value: string,
  {
    min = 1,
    max = 99,
    label = 'Value',
  }: { min?: number; max?: number; label?: string } = {},
): FieldCheck {
  const v = value.trim();
  if (!v) return ok; // optional — required-ness is the caller's choice
  if (!/^\d+$/.test(v)) return bad(`${label} must be a whole number.`);
  const n = Number(v);
  if (n < min || n > max)
    return bad(`${label} must be between ${min} and ${max}.`);
  return ok;
}
