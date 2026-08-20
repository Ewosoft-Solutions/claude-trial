/**
 * Navigation shell preferences — how the menu is laid out, per browser.
 *
 * Stored in cookies (not localStorage) so the SERVER layout can read them and
 * render the right chrome on first paint — a collapsed user who refreshes never
 * sees an expand→collapse flash, and a user who pinned the mobile rail never
 * sees the bottom bar flash past. Per-browser MVP; a cross-device version would
 * need a server-side user preference.
 */

/* ---- desktop rail: collapsed or expanded ----
 * `'0'` = collapsed, anything else (incl. absent) = expanded (the default). */

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

/* ---- phones: bottom tab bar (default) or the pinned collapsed rail ----
 * `'rail'` pins the rail and removes the bottom bar; anything else (incl.
 * absent) keeps the bottom bar + drawer. */

export const MOBILE_NAV_COOKIE = 'pref_mobile_nav';

/** Server/shared: interpret the raw cookie value (default bottom bar). */
export function mobileNavPinnedFromCookie(
  raw: string | undefined | null,
): boolean {
  return raw === 'rail';
}

/** Client: mirror the pinned state to a cookie (1 year, all paths). */
export function writeMobileNavPreference(pinned: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${MOBILE_NAV_COOKIE}=${pinned ? 'rail' : 'bar'}; path=/; max-age=31536000; samesite=lax`;
}
