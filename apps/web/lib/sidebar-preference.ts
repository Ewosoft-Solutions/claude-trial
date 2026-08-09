/**
 * Desktop sidebar collapsed/expanded preference.
 *
 * Stored in a cookie (not localStorage) so the SERVER layout can read it and
 * render the rail at the right width on first paint — a collapsed user who
 * refreshes never sees an expand→collapse flash. Per-browser MVP; a cross-device
 * version would need a server-side user preference.
 *
 * `'0'` = collapsed, anything else (incl. absent) = expanded (the default).
 */

export const SIDEBAR_COOKIE = 'pref_sidebar_expanded';

/** Server/shared: interpret the raw cookie value (default expanded). */
export function sidebarExpandedFromCookie(
  raw: string | undefined | null,
): boolean {
  return raw !== '0';
}

/** Client: mirror the expanded state to a cookie (1 year, all paths). */
export function writeSidebarPreference(expanded: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SIDEBAR_COOKIE}=${expanded ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
}
