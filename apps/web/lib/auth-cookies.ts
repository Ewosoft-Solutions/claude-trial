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
export const COOKIE_SESSION_RESUME = 'swe_session_resume';

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

/**
 * Non-httpOnly hint cookie for the returning-user login experience. Holds the
 * last signed-in user's first name + email (JSON) so the login page can greet
 * them ("Welcome back, Jane") and surface passkey sign-in. Deliberately
 * readable by client JS — it carries NO credential, only display/identity hints
 * for a device the user already signed in on. Persists across logout (that's
 * the point); a "Not you?" control clears it.
 */
export const COOKIE_LAST_USER = 'swe_last_user';

/** Cookie attributes for the readable hint cookie (not HttpOnly). */
const HINT_BASE = [
  'Path=/',
  'SameSite=Lax',
  process.env.NODE_ENV === 'production' ? 'Secure' : '',
]
  .filter(Boolean)
  .join('; ');

/** Serialize the returning-user hint into a Set-Cookie value. */
export function makeSetHintCookie(
  hint: { firstName?: string | null; email: string },
  maxAgeSeconds: number,
) {
  const value = encodeURIComponent(
    JSON.stringify({ firstName: hint.firstName ?? '', email: hint.email }),
  );
  return `${COOKIE_LAST_USER}=${value}; ${HINT_BASE}; Max-Age=${maxAgeSeconds}`;
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
