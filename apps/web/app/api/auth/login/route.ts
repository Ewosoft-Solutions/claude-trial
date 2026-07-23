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
import { apiClient, ApiError, apiErrorBody } from '@/lib/api-client';
import {
  clearAuthCookie,
  COOKIE_ACCESS_TOKEN,
  COOKIE_POST_LOGIN_REDIRECT,
  COOKIE_REFRESH_TOKEN,
  isSafeRedirectPath,
  setAuthCookie,
  setHintCookie,
} from '@/lib/auth-cookies';

interface LoginBody {
  email: string;
  password: string;
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
  /**
   * Set when the account holds an assigned password that must be rotated. The
   * API deliberately withholds the pre-auth token in this case, so there is
   * nothing to select a school with — see `passwordRotationRequiredResponse`
   * in the API's authentication service.
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

    // Forced rotation — forward so the client can run the rotation step. This
    // must be checked before the school lookup below: the API returns no token
    // AND no schools here, so falling through would report a password problem
    // as "no school available", which is what it used to do.
    if (loginRes.mustChangePassword) {
      return NextResponse.json(loginRes);
    }

    // Step 2 — select school context
    // Use provided tenantId/profileId or pick the first available school.
    const targetTenantId = tenantId ?? loginRes.schools[0]?.tenantId;
    const targetProfileId = profileId ?? loginRes.schools[0]?.profileId;

    // Every case where the API stops short deliberately (MFA, forced rotation)
    // is handled above, so a missing token here means the response is a shape
    // this proxy does not know how to complete — a contract mismatch, not a
    // user-fixable problem. Report it as such instead of blaming the account.
    if (!loginRes.token) {
      console.error(
        '[auth/login] login succeeded but issued no pre-auth token',
        { requiresMfa: loginRes.requiresMfa, schools: loginRes.schools.length },
      );
      return NextResponse.json(
        apiErrorBody(
          'Sign in could not be completed',
          'POST /auth/login returned success with no token and no recognised ' +
            'stop-short flag (requiresMfa / mustChangePassword).',
        ),
        { status: 502 },
      );
    }

    if (!targetTenantId || !targetProfileId) {
      // A real authorisation gap: the credentials are valid but the account is
      // linked to no active profile — including the platform workspace a
      // platform-scoped role such as Architect signs in through. Nothing the
      // user can do about it, so say who can.
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
      { tenantId: targetTenantId, profileId: targetProfileId },
      { Authorization: `Bearer ${loginRes.token}` },
    );

    // Single-use post-login redirect, read from the httpOnly cookie the
    // auth middleware set (never trust a client-supplied value here either).
    const redirectCookie = req.cookies.get(COOKIE_POST_LOGIN_REDIRECT)?.value;
    const redirectTo = isSafeRedirectPath(redirectCookie)
      ? redirectCookie
      : undefined;

    // Set httpOnly cookies — 1 h access, 7 d refresh
    const response = NextResponse.json({
      success: true,
      schools: loginRes.schools,
      tenantContext: selectRes.tenantContext,
      redirectTo,
    });

    // Via cookies.set, not headers.append: appending four Set-Cookie headers
    // silently dropped the FIRST one, so the access token never reached the
    // browser while the other three did — see the note in lib/auth-cookies.ts.
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
    // Returning-user hint (readable, no credential) so the next visit can greet
    // them and offer passkey sign-in. 30-day life; persists across logout.
    setHintCookie(
      response,
      { firstName: loginRes.user.firstName, email: loginRes.user.email },
      30 * 24 * 3600,
    );

    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(apiErrorBody(err.message, err.internalMessage), {
        status: err.status,
      });
    }
    console.error('[auth/login] unhandled error:', err);
    return NextResponse.json(
      apiErrorBody(
        'Internal server error',
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      ),
      { status: 500 },
    );
  }
}
