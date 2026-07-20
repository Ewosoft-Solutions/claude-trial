/**
 * POST /api/auth/verify-mfa
 *
 * Complete the MFA challenge and exchange for a full session.
 *   1. POST /auth/verify-mfa-login → get pre-auth token + school list
 *   2. POST /auth/select-school    → exchange for access/refresh tokens
 *
 * On success: sets httpOnly access + refresh cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_POST_LOGIN_REDIRECT,
  COOKIE_REFRESH_TOKEN,
  isSafeRedirectPath,
  makeClearCookie,
  makeSetCookie,
} from '@/lib/auth-cookies';

interface VerifyMfaBody {
  challengeId: string;
  code: string;
}

interface VerifyMfaApiResponse {
  success: boolean;
  user: { id: string; email: string };
  token?: string;
  schools: Array<{ tenantId: string; profileId: string }>;
}

interface SelectSchoolApiResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tenantContext: { tenantId: string; profileId: string; userId: string; roleId: string };
}

export async function POST(req: NextRequest) {
  try {
    const { challengeId, code }: VerifyMfaBody = await req.json();

    // Step 1 — verify MFA challenge
    const verifyRes = await apiClient.post<VerifyMfaApiResponse>(
      '/auth/verify-mfa-login',
      { challengeId, code },
    );

    if (!verifyRes.success || !verifyRes.token) {
      return NextResponse.json({ error: 'MFA verification failed' }, { status: 401 });
    }

    // Step 2 — select school (pick first available)
    const school = verifyRes.schools[0];
    if (!school) {
      return NextResponse.json({ error: 'No school available for this account' }, { status: 403 });
    }

    const selectRes = await apiClient.post<SelectSchoolApiResponse>(
      '/auth/select-school',
      { tenantId: school.tenantId, profileId: school.profileId },
      { Authorization: `Bearer ${verifyRes.token}` },
    );

    const redirectCookie = req.cookies.get(COOKIE_POST_LOGIN_REDIRECT)?.value;
    const redirectTo = isSafeRedirectPath(redirectCookie) ? redirectCookie : undefined;

    const response = NextResponse.json({
      success: true,
      tenantContext: selectRes.tenantContext,
      redirectTo,
    });

    response.headers.append(
      'Set-Cookie',
      makeSetCookie(COOKIE_ACCESS_TOKEN, selectRes.accessToken, selectRes.expiresIn),
    );
    response.headers.append(
      'Set-Cookie',
      makeSetCookie(COOKIE_REFRESH_TOKEN, selectRes.refreshToken, 7 * 24 * 3600),
    );
    response.headers.append('Set-Cookie', makeClearCookie(COOKIE_POST_LOGIN_REDIRECT));

    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/verify-mfa]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
