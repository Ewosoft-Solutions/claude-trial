/**
 * Edge middleware — canonical origin, coarse authentication gate, and an
 * optional development host hint.
 *
 * Redirects to /login when an app route is requested without an access-token
 * cookie. An optional host hint remains available for local/legacy previews;
 * production tenant authority comes from the authenticated profile context.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_POST_LOGIN_REDIRECT,
  COOKIE_SESSION_RESUME,
  isSafeRedirectPath,
} from './lib/auth-cookies';
import {
  buildCanonicalHostRedirectUrl,
  buildHttpsRedirectUrl,
  shouldRedirectToHttps,
} from './lib/secure-origin';
import {
  createResumeState,
  RESUME_MAX_AGE_SECONDS,
  signResumeState,
} from './lib/resume-state';
import { extractTenantSlug, TENANT_SLUG_HEADER } from './lib/tenant-host';

const PUBLIC_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/session/resume',
]);

/**
 * Resolve an optional development/legacy host hint and forward it to the app.
 * This is never an authorization boundary; the canonical production app uses
 * the authenticated school/profile selection as tenant authority.
 */
function tenantAwareNext(req: NextRequest): NextResponse {
  const slug = extractTenantSlug(req.headers.get('host'));
  if (!slug) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set(TENANT_SLUG_HEADER, slug);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(req: NextRequest) {
  const forwardedHost =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const forwardedProto =
    req.headers.get('x-forwarded-proto') ??
    req.nextUrl.protocol.replace(/:$/, '');

  const canonicalUrl = buildCanonicalHostRedirectUrl(
    req.url,
    forwardedHost,
    process.env.APP_CANONICAL_ORIGIN,
  );
  if (canonicalUrl) {
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (shouldRedirectToHttps(forwardedHost, forwardedProto)) {
    const httpsUrl = buildHttpsRedirectUrl(req.url, forwardedHost);
    return NextResponse.redirect(httpsUrl, 308);
  }

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
    const hasRefreshToken = req.cookies.has(COOKIE_REFRESH_TOKEN);

    // Installed PWAs are commonly suspended past the one-hour access-token
    // lifetime. If the fixed-lifetime refresh session remains valid, pass
    // through a public refresh trampoline instead of showing a false logout.
    if (hasRefreshToken) {
      const resumeUrl = req.nextUrl.clone();
      resumeUrl.pathname = '/session/resume';
      resumeUrl.search = '';
      const response = NextResponse.redirect(resumeUrl);
      const state = createResumeState({
        path: `${pathname}${req.nextUrl.search}`,
      });
      const signed = state ? await signResumeState(state) : null;
      if (signed) {
        response.cookies.set(COOKIE_SESSION_RESUME, signed, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: RESUME_MAX_AGE_SECONDS,
        });
      }
      response.cookies.set(COOKIE_POST_LOGIN_REDIRECT, '/session/resume', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: RESUME_MAX_AGE_SECONDS,
      });
      return response;
    }

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
