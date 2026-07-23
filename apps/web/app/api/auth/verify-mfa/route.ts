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
  clearAuthCookie,
  COOKIE_ACCESS_TOKEN,
  COOKIE_POST_LOGIN_REDIRECT,
  COOKIE_REFRESH_TOKEN,
  isSafeRedirectPath,
  setAuthCookie,
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
  /**
   * Forced rotation is evaluated AFTER the second factor, so it surfaces here
   * as well as on /auth/login — an enrolled user proves MFA first, then learns
   * the password must change. Like login, the API withholds the token.
   */
  mustChangePassword?: boolean;
}

interface SelectSchoolApiResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tenantContext: {
    tenantId: string;
    profileId: string;
    userId: string;
    roleId: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { challengeId, code }: VerifyMfaBody = await req.json();

    // Step 1 — verify MFA challenge
    const verifyRes = await apiClient.post<VerifyMfaApiResponse>(
      '/auth/verify-mfa-login',
      { challengeId, code },
    );

    if (!verifyRes.success) {
      return NextResponse.json(
        { error: 'MFA verification failed' },
        { status: 401 },
      );
    }

    // The code was correct, but the password must be rotated before a session
    // is issued. Checked before the token test below, which would otherwise
    // report a successful verification as "MFA verification failed".
    if (verifyRes.mustChangePassword) {
      return NextResponse.json(verifyRes);
    }

    if (!verifyRes.token) {
      return NextResponse.json(
        { error: 'MFA verification failed' },
        { status: 401 },
      );
    }

    // Step 2 — select school (pick first available)
    const school = verifyRes.schools[0];
    if (!school) {
      return NextResponse.json(
        {
          error:
            'This account is not linked to an active school or platform workspace. ' +
            'Ask an administrator to assign one.',
        },
        { status: 403 },
      );
    }

    const selectRes = await apiClient.post<SelectSchoolApiResponse>(
      '/auth/select-school',
      { tenantId: school.tenantId, profileId: school.profileId },
      { Authorization: `Bearer ${verifyRes.token}` },
    );

    const redirectCookie = req.cookies.get(COOKIE_POST_LOGIN_REDIRECT)?.value;
    const redirectTo = isSafeRedirectPath(redirectCookie)
      ? redirectCookie
      : undefined;

    const response = NextResponse.json({
      success: true,
      tenantContext: selectRes.tenantContext,
      redirectTo,
    });

    setAuthCookie(
      response,
      COOKIE_ACCESS_TOKEN,
      selectRes.accessToken,
      selectRes.expiresIn,
    );
    setAuthCookie(
      response,
      COOKIE_REFRESH_TOKEN,
      selectRes.refreshToken,
      7 * 24 * 3600,
    );
    clearAuthCookie(response, COOKIE_POST_LOGIN_REDIRECT);

    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/verify-mfa]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
