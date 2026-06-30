/**
 * POST /api/auth/login
 *
 * Proxy for the two-step backend auth flow:
 *   1. POST /auth/login  → validate credentials, get pre-auth token + school list
 *   2. POST /auth/select-school → exchange pre-auth token for access/refresh tokens
 *
 * On success: sets httpOnly access + refresh cookies and returns the tenantContext.
 * On failure: forwards the backend error status/message.
 *
 * The caller supplies { email, password, tenantId, profileId }.
 * If the login step requires MFA the response is forwarded as-is (requiresMfa: true).
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

interface LoginBody {
  email: string;
  password: string;
  tenantId?: string;
  profileId?: string;
}

interface LoginApiResponse {
  success: boolean;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  // Minimal school-picker shape — no role/org detail until after select-school.
  schools: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug?: string;
    profileId: string;
    schoolType?: string;
  }>;
  token?: string;
  requiresMfa?: boolean;
  mfaChallengeId?: string;
}

interface SelectSchoolApiResponse {
  success: boolean;
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
    const body: LoginBody = await req.json();
    const { email, password, tenantId, profileId } = body;

    // Step 1 — credentials check
    const loginRes = await apiClient.post<LoginApiResponse>('/auth/login', {
      email,
      password,
    });

    if (!loginRes.success) {
      return NextResponse.json({ error: 'Login failed' }, { status: 401 });
    }

    // MFA required — forward to the client to complete the challenge
    if (loginRes.requiresMfa) {
      return NextResponse.json(loginRes);
    }

    // Step 2 — select school context
    // Use provided tenantId/profileId or pick the first available school.
    const targetTenantId = tenantId ?? loginRes.schools[0]?.tenantId;
    const targetProfileId = profileId ?? loginRes.schools[0]?.profileId;

    if (!targetTenantId || !targetProfileId || !loginRes.token) {
      return NextResponse.json(
        { error: 'No school available for this account' },
        { status: 403 },
      );
    }

    const selectRes = await apiClient.post<SelectSchoolApiResponse>(
      '/auth/select-school',
      { tenantId: targetTenantId, profileId: targetProfileId },
      { Authorization: `Bearer ${loginRes.token}` },
    );

    // Single-use post-login redirect, read from the httpOnly cookie the
    // auth middleware set (never trust a client-supplied value here either).
    const redirectCookie = req.cookies.get(COOKIE_POST_LOGIN_REDIRECT)?.value;
    const redirectTo = isSafeRedirectPath(redirectCookie) ? redirectCookie : undefined;

    // Set httpOnly cookies — 1 h access, 7 d refresh
    const response = NextResponse.json({
      success: true,
      schools: loginRes.schools,
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
    console.error('[auth/login]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
