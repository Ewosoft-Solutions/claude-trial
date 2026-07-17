/**
 * PATCH /api/auth/default-profile
 *
 * Sets which profile the signed-in user should be auto-selected into at
 * future logins (Account settings › Profile). Proxies to the backend's
 * JwtAuthGuard-protected PATCH /auth/default-profile, which validates the
 * target profile belongs to the calling user before persisting it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';
import {
  apiErrorResponse,
  bearerAuthHeaders,
  withAccessRefresh,
} from '@/lib/api-proxy';
import { attachRefreshedAccess } from '@/lib/server-refresh';

interface SetDefaultProfileBody {
  profileId: string;
}

export async function PATCH(req: NextRequest) {
  try {
    const body: SetDefaultProfileBody = await req.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 },
      );
    }

    const { value: result, refreshed } = await withAccessRefresh(
      req,
      (accessToken) =>
        apiClient.patch<{ success: boolean; defaultProfileId: string }>(
          '/auth/default-profile',
          { profileId },
          bearerAuthHeaders(req, accessToken),
        ),
    );

    return attachRefreshedAccess(NextResponse.json(result), refreshed);
  } catch (err) {
    console.error('[auth/default-profile]', err);
    return apiErrorResponse(err);
  }
}
