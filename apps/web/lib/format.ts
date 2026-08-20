/**
 * App-wide number formatting. Money and counts are ALWAYS shown in full — never
 * abbreviated (no "₦825.0k", no "1k"): money as ₦ + thousands separators + 2
 * decimals; counts with thousands separators. The locale is pinned to en-NG so
 * SSR and the client render identically (no hydration mismatch).
 */

/**
 * Full Naira amount from minor units (kobo): `82_553_800 → "₦825,538.00"`.
 * Unset (null/undefined/NaN) renders as an em dash so "not set" reads clearly.
 */
export function formatNaira(minorUnits: number | null | undefined): string {
  if (minorUnits == null || !Number.isFinite(minorUnits)) return '—';
  return `₦${(minorUnits / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Full integer count with thousands separators: `1000 → "1,000"`. */
export function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return n.toLocaleString('en-NG');
}

/**
 * Parse a ₦ amount typed by a person into kobo — the inverse of
 * `formatNaira`, and the only place that conversion should live.
 *
 * Returns null for blank or unusable input rather than 0, because those mean
 * different things on an invoice: "nothing entered yet" is not "free".
 * Commas are tolerated since people type them, and the result is rounded to
 * whole kobo so floating-point naira can never leave a fraction of a kobo in
 * the ledger.
 */
export function koboFromNaira(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const naira = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(naira) || naira < 0) return null;
  return Math.round(naira * 100);
}
