/**
 * Table page-size preference.
 *
 * The number of rows a user wants per table is remembered in a cookie
 * (`pref_page_size`) so every directory across the app opens at their preferred
 * size, and it survives logout/login on the same browser. A cookie (not
 * localStorage) is used so the SERVER page can read it and render the first page
 * at the right size — no flash, no hydration mismatch.
 *
 * Cross-DEVICE persistence (tied to the account) would need a server-side user
 * preference; this cookie is the per-browser MVP.
 *
 * Pure + client-only helpers live here (safe to import in server components —
 * the client helpers guard on `document`). Server components read the cookie via
 * `next/headers` and pass the value through `normalizePageSize`.
 */

export const PAGE_SIZE_COOKIE = 'pref_page_size';
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

/** Coerce any raw value to an allowed page size (else the default). */
export function normalizePageSize(
  raw: string | number | undefined | null,
): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n ?? NaN)
    ? (n as number)
    : DEFAULT_PAGE_SIZE;
}

/** Client: the saved page-size preference from `document.cookie`. */
export function readPageSizePreference(): number {
  if (typeof document === 'undefined') return DEFAULT_PAGE_SIZE;
  const match = document.cookie.match(/(?:^|;\s*)pref_page_size=(\d+)/);
  return normalizePageSize(match?.[1]);
}

/** Client: mirror the page-size preference to a cookie (1 year, all paths). */
export function writePageSizePreference(size: number): void {
  if (typeof document === 'undefined') return;
  const value = normalizePageSize(size);
  document.cookie = `${PAGE_SIZE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Client: save the page-size preference everywhere — the cookie (instant, local)
 * AND the per-account record (durable, cross-device). The cookie write is
 * synchronous so the next SSR paint is correct immediately; the account PATCH is
 * best-effort (a failure just means this browser keeps the cookie value).
 */
export function savePageSizePreference(size: number): void {
  const value = normalizePageSize(size);
  writePageSizePreference(value);
  void fetch('/api/auth/preferences', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ defaultPageSize: value }),
  }).catch(() => {
    /* best-effort: the cookie already holds the preference on this browser */
  });
}
