/**
 * Regression guard for refresh-token rotation: a refreshed response must now
 * carry BOTH the new access cookie AND the rotated refresh cookie, and both
 * must go through `cookies.set` (Next's per-cookie serializer) rather than a
 * second `headers.append('Set-Cookie', …)`.
 *
 * Appending more than one Set-Cookie header on a single response drops the
 * first (the login-loop bug documented in auth-cookies.ts). If rotation dropped
 * the refresh cookie, the next refresh would replay a retired token and trip
 * server-side reuse detection — logging the user out. So we assert the property
 * that would break: two distinct cookies, both present, refresh value intact.
 */
import { describe, expect, it, vi } from 'vitest';

// server-refresh is a server-only module; stub the marker + the API client it
// imports at load time (attachRefreshedAccess itself uses neither).
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }));

import { attachRefreshedAccess, type RefreshedAccess } from './server-refresh';
import { COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN } from './auth-cookies';

type Written = { name: string; value: string; options: Record<string, unknown> };

/** Stand-in for NextResponse's cookie jar, recording every write. */
function fakeResponse() {
  const written: Written[] = [];
  return {
    written,
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown> = {}) => {
        written.push({ name, value, options });
      },
    },
  };
}

const refreshed: RefreshedAccess = {
  accessToken: 'access-token-value',
  accessMaxAge: 3600,
  refreshToken: 'rotated-refresh-value',
  refreshMaxAge: 600_000,
};

describe('attachRefreshedAccess', () => {
  it('writes both the access and rotated refresh cookies, none swallowed', () => {
    const res = fakeResponse();

    attachRefreshedAccess(res as never, refreshed);

    expect(res.written.map((c) => c.name)).toEqual([
      COOKIE_ACCESS_TOKEN,
      COOKIE_REFRESH_TOKEN,
    ]);

    const refresh = res.written.find((c) => c.name === COOKIE_REFRESH_TOKEN);
    expect(refresh?.value).toBe('rotated-refresh-value');
    // Max-Age is the REMAINING life of the fixed session — never a fresh 7 days.
    expect(refresh?.options.maxAge).toBe(600_000);
    // httpOnly on both, so the browser never exposes them to JS.
    expect(refresh?.options.httpOnly).toBe(true);

    const access = res.written.find((c) => c.name === COOKIE_ACCESS_TOKEN);
    expect(access?.value).toBe('access-token-value');
    expect(access?.options.maxAge).toBe(3600);
  });

  it('writes nothing when there is no refreshed access', () => {
    const res = fakeResponse();
    attachRefreshedAccess(res as never, null);
    expect(res.written).toHaveLength(0);
  });
});
