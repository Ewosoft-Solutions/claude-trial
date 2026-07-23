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
import { apiClient } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  setAuthCookie,
} from '@/lib/auth-cookies';
import {
  apiErrorResponse,
  bearerAuthHeaders,
  withAccessRefresh,
} from '@/lib/api-proxy';

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

    const { value: result } = await withAccessRefresh(req, (accessToken) =>
      apiClient.post<SwitchProfileApiResponse>(
        '/auth/switch-profile',
        { tenantId, profileId },
        bearerAuthHeaders(req, accessToken),
      ),
    );

    const response = NextResponse.json({
      success: true,
      tenantContext: result.tenantContext,
    });

    setAuthCookie(
      response,
      COOKIE_ACCESS_TOKEN,
      result.accessToken,
      result.expiresIn,
    );
    setAuthCookie(
      response,
      COOKIE_REFRESH_TOKEN,
      result.refreshToken,
      7 * 24 * 3600,
    );

    return response;
  } catch (err) {
    console.error('[auth/switch-profile]', err);
    return apiErrorResponse(err);
  }
}
