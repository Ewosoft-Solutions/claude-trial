/**
 * Edge middleware — coarse authentication gate + subdomain tenant tagging.
 *
 * Redirects to /login when an (app) route is requested without an
 * access-token cookie, and forwards the resolved `{slug}.domain` tenant slug
 * to the app as a request header for server-side use.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_POST_LOGIN_REDIRECT,
  isSafeRedirectPath,
} from './lib/auth-cookies';
import { extractTenantSlug, TENANT_SLUG_HEADER } from './lib/tenant-host';

const PUBLIC_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
]);

/**
 * Resolve the subdomain tenant slug and forward it to the app as a request
 * header, so server components (login branding, tenant preference) can read it
 * without a per-request DB lookup at the edge. Returns a response whose
 * downstream request carries the header; `null` slug (apex/reserved host)
 * passes through untouched.
 */
function tenantAwareNext(req: NextRequest): NextResponse {
  const slug = extractTenantSlug(req.headers.get('host'));
  if (!slug) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set(TENANT_SLUG_HEADER, slug);
  return NextResponse.next({ request: { headers } });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let public paths and Next.js internals through (still tenant-tagged).
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return tenantAwareNext(req);
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

  return tenantAwareNext(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
