/**
 * Edge middleware — coarse authentication gate.
 *
 * Redirects to /login when an (app) route is requested without an
 * access-token cookie AND the API is configured (real auth mode).
 * In dev without an API URL the mock session is used; middleware
 * must not redirect in that case.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_POST_LOGIN_REDIRECT,
  isSafeRedirectPath,
} from './lib/auth-cookies';

const PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/reset-password']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let public paths and Next.js internals through
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // In dev without a backend, the app layout mock handles the session
  if (!process.env.NEXT_PUBLIC_API_URL) {
    return NextResponse.next();
  }

  const hasToken = req.cookies.has(COOKIE_ACCESS_TOKEN);
  if (!hasToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    const res = NextResponse.redirect(loginUrl);

    // Stash the intended destination in an httpOnly cookie instead of a
    // `?from=` query param — keeps it out of the URL bar, browser history,
    // and referrer headers, and out of reach of client JS / user editing.
    if (isSafeRedirectPath(pathname)) {
      res.cookies.set(COOKIE_POST_LOGIN_REDIRECT, pathname, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 300,
      });
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
