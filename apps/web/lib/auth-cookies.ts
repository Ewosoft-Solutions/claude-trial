/**
 * Auth cookie names and server-side helpers.
 * All tokens are stored in httpOnly cookies so they never touch client JS.
 */

export const COOKIE_ACCESS_TOKEN = 'swe_access';
export const COOKIE_REFRESH_TOKEN = 'swe_refresh';

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
