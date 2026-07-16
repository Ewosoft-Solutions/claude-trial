/**
 * POST /api/auth/passkey/verify
 *
 * Completes a passwordless passkey login. Mirrors /api/auth/login's second half:
 *   1. POST /auth/passkey/login/verify → verify assertion, get pre-auth token + schools
 *   2. POST /auth/select-school → exchange pre-auth token for access/refresh tokens
 * then sets the httpOnly session cookies + the returning-user hint.
 *
 * Caller supplies { challengeId, authenticationResponse, tenantId?, profileId? }.
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
  makeSetHintCookie,
} from '@/lib/auth-cookies';

interface VerifyBody {
  challengeId: string;
  authenticationResponse: unknown;
  tenantId?: string;
  profileId?: string;
}

interface LoginApiResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  schools: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug?: string;
    profileId: string;
    schoolType?: string;
  }>;
  token?: string;
}

interface SelectSchoolApiResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tenantContext: {
    tenantId: string;
    tenantSlug?: string;
    userId: string;
    profileId: string;
    roleId: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: VerifyBody = await req.json();

    // Step 1 — verify the passkey assertion (replaces the credentials check)
    const loginRes = await apiClient.post<LoginApiResponse>(
      '/auth/passkey/login/verify',
      {
        challengeId: body.challengeId,
        authenticationResponse: body.authenticationResponse,
      },
    );

    const targetTenantId = body.tenantId ?? loginRes.schools[0]?.tenantId;
    const targetProfileId = body.profileId ?? loginRes.schools[0]?.profileId;

    if (!targetTenantId || !targetProfileId || !loginRes.token) {
      return NextResponse.json(
        { error: 'No school available for this account' },
        { status: 403 },
      );
    }

    // Step 2 — select school context
    const selectRes = await apiClient.post<SelectSchoolApiResponse>(
      '/auth/select-school',
      { tenantId: targetTenantId, profileId: targetProfileId },
      { Authorization: `Bearer ${loginRes.token}` },
    );

    const redirectCookie = req.cookies.get(COOKIE_POST_LOGIN_REDIRECT)?.value;
    const redirectTo = isSafeRedirectPath(redirectCookie)
      ? redirectCookie
      : undefined;

    const response = NextResponse.json({
      success: true,
      schools: loginRes.schools,
      tenantContext: selectRes.tenantContext,
      redirectTo,
    });

    response.headers.append(
      'Set-Cookie',
      makeSetCookie(
        COOKIE_ACCESS_TOKEN,
        selectRes.accessToken,
        selectRes.expiresIn,
      ),
    );
    response.headers.append(
      'Set-Cookie',
      makeSetCookie(COOKIE_REFRESH_TOKEN, selectRes.refreshToken, 7 * 24 * 3600),
    );
    response.headers.append(
      'Set-Cookie',
      makeClearCookie(COOKIE_POST_LOGIN_REDIRECT),
    );
    response.headers.append(
      'Set-Cookie',
      makeSetHintCookie(
        { firstName: loginRes.user.firstName, email: loginRes.user.email },
        30 * 24 * 3600,
      ),
    );

    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/passkey/verify]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
