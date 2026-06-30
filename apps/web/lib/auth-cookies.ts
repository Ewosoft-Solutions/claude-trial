/**
 * Auth cookie names and server-side helpers.
 * All tokens are stored in httpOnly cookies so they never touch client JS.
 */

export const COOKIE_ACCESS_TOKEN = 'swe_access';
export const COOKIE_REFRESH_TOKEN = 'swe_refresh';

/**
 * Short-lived, httpOnly, single-use cookie holding the path to return to
 * after login. Never surfaced in the URL (no `?from=` query param) so it
 * can't be seen, bookmarked, or hand-edited by the user — the only writer
 * is the auth middleware, based on the page they were actually requesting.
 */
export const COOKIE_POST_LOGIN_REDIRECT = 'swe_post_login_redirect';

/**
 * Validates a path before it's ever used as a redirect target — applied
 * both when the middleware writes the cookie and again when the login
 * route reads it back, so a tampered or malformed cookie value can never
 * produce an open redirect. Must be an in-app, single-leading-slash path.
 */
export function isSafeRedirectPath(path: string | undefined | null): path is string {
  if (!path) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false; // protocol-relative (//evil.com)
  if (path.includes('://')) return false; // absolute URL embedded as a path
  if (path.startsWith('/\\')) return false; // backslash trick some parsers treat as //
  if (path === '/login' || path.startsWith('/login?') || path.startsWith('/login/')) return false;
  return true;
}

/** Base cookie attributes shared across all auth cookies. */
export const COOKIE_BASE = [
  'HttpOnly',
  'Path=/',
  'SameSite=Lax',
  process.env.NODE_ENV === 'production' ? 'Secure' : '',
]
  .filter(Boolean)
  .join('; ');

export function makeSetCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${value}; ${COOKIE_BASE}; Max-Age=${maxAgeSeconds}`;
}

export function makeClearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; Max-Age=0`;
}
