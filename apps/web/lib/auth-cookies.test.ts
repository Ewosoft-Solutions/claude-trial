/**
 * Regression test: a response that sets several auth cookies must emit every
 * one of them.
 *
 * The login route used to append four Set-Cookie HEADERS. The browser stored
 * three and dropped the first — the access token. Everything downstream then
 * behaved exactly as designed: the middleware saw "no access cookie but a
 * refresh cookie", routed to /session/resume, the refresh attempt failed and
 * cleared both cookies, and the user arrived back at /login. A login loop whose
 * only symptom was landing on the login page, with no error anywhere.
 *
 * Nothing in the suite caught it because every unit under test was correct in
 * isolation. What was wrong was the number of headers on one response.
 *
 * These tests therefore assert the property that actually broke: after writing
 * the full login cookie set, all four are present, distinct, and carry the
 * attributes they are supposed to.
 */

import { describe, expect, it } from 'vitest';
import {
  clearAuthCookie,
  COOKIE_ACCESS_TOKEN,
  COOKIE_LAST_USER,
  COOKIE_POST_LOGIN_REDIRECT,
  COOKIE_REFRESH_TOKEN,
  setAuthCookie,
  setHintCookie,
} from './auth-cookies';

type Written = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

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

describe('auth cookie writers', () => {
  it('emits every cookie of a full login response, none swallowed', () => {
    const res = fakeResponse();

    // Exactly what POST /api/auth/login writes, in order.
    setAuthCookie(res, COOKIE_ACCESS_TOKEN, 'access-token-value', 3600);
    setAuthCookie(res, COOKIE_REFRESH_TOKEN, 'refresh-token-value', 604800);
    clearAuthCookie(res, COOKIE_POST_LOGIN_REDIRECT);
    setHintCookie(res, { firstName: 'Platform', email: 'a@b.test' }, 2592000);

    expect(res.written).toHaveLength(4);
    expect(res.written.map((c) => c.name)).toEqual([
      COOKIE_ACCESS_TOKEN,
      COOKIE_REFRESH_TOKEN,
      COOKIE_POST_LOGIN_REDIRECT,
      COOKIE_LAST_USER,
    ]);

    // The access token is the one that went missing — assert it explicitly,
    // with its value intact rather than merely present.
    const access = res.written.find((c) => c.name === COOKIE_ACCESS_TOKEN);
    expect(access?.value).toBe('access-token-value');
    expect(access?.options.maxAge).toBe(3600);
  });

  it('marks token cookies httpOnly and path-wide', () => {
    const res = fakeResponse();
    setAuthCookie(res, COOKIE_ACCESS_TOKEN, 'v', 3600);

    expect(res.written[0]?.options).toMatchObject({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    });
  });

  it('leaves the returning-user hint readable by client JS', () => {
    // Deliberately NOT httpOnly: the login page reads it to greet the user.
    // It carries no credential.
    const res = fakeResponse();
    setHintCookie(res, { firstName: 'Platform', email: 'a@b.test' }, 2592000);

    expect(res.written[0]?.options.httpOnly).toBeUndefined();
    expect(String(res.written[0]?.value)).toContain('a@b.test');
  });

  it('expires a cleared cookie rather than deleting the entry', () => {
    const res = fakeResponse();
    clearAuthCookie(res, COOKIE_REFRESH_TOKEN);

    expect(res.written[0]?.value).toBe('');
    expect(res.written[0]?.options.maxAge).toBe(0);
  });
});
