/**
 * POST /api/auth/logout
 *
 * Calls /auth/logout on the backend (revokes the refresh-token session) then
 * clears both httpOnly auth cookies. The access token authenticates the call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiClient } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_POST_LOGIN_REDIRECT,
  COOKIE_SESSION_RESUME,
  makeClearCookie,
} from '@/lib/auth-cookies';
import {
  buildLogoutRequest,
  resolveLogoutReturnPath,
} from '@/lib/logout-request';
import {
  createResumeState,
  RESUME_MAX_AGE_SECONDS,
  signResumeState,
  type ResumableModalKey,
} from '@/lib/resume-state';

interface LogoutBody {
  reason?: 'manual' | 'idle' | 'absolute_expiry' | 'refresh_failed';
  tenantId?: string;
  profileId?: string;
  modalKey?: ResumableModalKey;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as LogoutBody;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  const refreshToken = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value;
  const logoutRequest = buildLogoutRequest(
    accessToken,
    refreshToken,
    body.reason,
  );

  if (logoutRequest) {
    try {
      await apiClient.post(
        '/auth/logout',
        logoutRequest.body,
        logoutRequest.headers,
      );
    } catch {
      // best-effort; clear cookies regardless
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.append('Set-Cookie', makeClearCookie(COOKIE_ACCESS_TOKEN));
  response.headers.append('Set-Cookie', makeClearCookie(COOKIE_REFRESH_TOKEN));

  const forwardedHost = req.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const forwardedProto = req.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const forwardedOrigin =
    forwardedHost && forwardedProto
      ? `${forwardedProto}://${forwardedHost}`
      : null;
  const returnTo = resolveLogoutReturnPath(
    req.headers.get('referer'),
    [req.nextUrl.origin, forwardedOrigin].filter((origin): origin is string =>
      Boolean(origin),
    ),
  );

  if (body.reason && body.reason !== 'manual' && returnTo) {
    const state = createResumeState({
      path: returnTo,
      tenantId: body.tenantId,
      profileId: body.profileId,
      modalKey: body.modalKey,
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
      response.cookies.set(COOKIE_POST_LOGIN_REDIRECT, '/session/resume', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: RESUME_MAX_AGE_SECONDS,
      });
    }
  }

  return response;
}
