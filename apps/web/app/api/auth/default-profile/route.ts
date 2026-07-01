/**
 * PATCH /api/auth/default-profile
 *
 * Sets which profile the signed-in user should be auto-selected into at
 * future logins (Account settings › Profile). Proxies to the backend's
 * JwtAuthGuard-protected PATCH /auth/default-profile, which validates the
 * target profile belongs to the calling user before persisting it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient, ApiError } from '@/lib/api-client';
import { COOKIE_ACCESS_TOKEN } from '@/lib/auth-cookies';

interface SetDefaultProfileBody {
  profileId: string;
}

export async function PATCH(req: NextRequest) {
  try {
    const body: SetDefaultProfileBody = await req.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    const accessToken = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const result = await apiClient.patch<{ success: boolean; defaultProfileId: string }>(
      '/auth/default-profile',
      { profileId },
      { Authorization: `Bearer ${accessToken}` },
    );

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/default-profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
