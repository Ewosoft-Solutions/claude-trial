/**
 * POST /api/auth/switch-profile
 *
 * Mid-session context switch — the signed-in user picks a different
 * profile they hold (a different role at the same school, or a
 * different school entirely) from the school/profile switcher.
 *
 * Distinct from /api/auth/login: this runs with the *current* access
 * token cookie, not a pre-auth token, and calls the backend's
 * JwtAuthGuard-protected POST /auth/switch-profile, which re-validates
 * that the target profile belongs to the calling user before issuing
 * fresh tokens.
 *
 * The caller supplies { tenantId, profileId }. On success the access
 * and refresh cookies are replaced in place — the frontend should
 * follow with a full reload so server components re-derive the session
 * (roles, clearanceLevel, permissions) from the new token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  makeSetCookie,
} from '@/lib/auth-cookies';

interface SwitchProfileBody {
  tenantId: string;
  profileId: string;
}

interface SwitchProfileApiResponse {
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
    const body: SwitchProfileBody = await req.json();
    const { tenantId, profileId } = body;

    if (!tenantId || !profileId) {
      return NextResponse.json(
        { error: 'tenantId and profileId are required' },
        { status: 400 },
      );
    }

    const accessToken = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const result = await apiClient.post<SwitchProfileApiResponse>(
      '/auth/switch-profile',
      { tenantId, profileId },
      { Authorization: `Bearer ${accessToken}` },
    );

    const response = NextResponse.json({
      success: true,
      tenantContext: result.tenantContext,
    });

    response.headers.append(
      'Set-Cookie',
      makeSetCookie(COOKIE_ACCESS_TOKEN, result.accessToken, result.expiresIn),
    );
    response.headers.append(
      'Set-Cookie',
      makeSetCookie(COOKIE_REFRESH_TOKEN, result.refreshToken, 7 * 24 * 3600),
    );

    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/switch-profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
