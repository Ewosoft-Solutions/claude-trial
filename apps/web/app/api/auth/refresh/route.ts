/**
 * POST /api/auth/refresh
 *
 * Refreshes the access token using the refresh token cookie.
 * Sets a new access-token cookie on success.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  makeSetCookie,
  makeClearCookie,
} from '@/lib/auth-cookies';

interface RefreshApiResponse {
  accessToken: string;
  expiresIn: number;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const res = await apiClient.post<RefreshApiResponse>('/auth/refresh', {
      refreshToken,
    });

    const response = NextResponse.json({ success: true });
    response.headers.append(
      'Set-Cookie',
      makeSetCookie(COOKIE_ACCESS_TOKEN, res.accessToken, res.expiresIn),
    );

    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      // Refresh token invalid — clear both cookies
      const response = NextResponse.json(
        { error: 'Session expired' },
        { status: 401 },
      );
      response.headers.append('Set-Cookie', makeClearCookie(COOKIE_ACCESS_TOKEN));
      response.headers.append('Set-Cookie', makeClearCookie(COOKIE_REFRESH_TOKEN));
      return response;
    }
    console.error('[auth/refresh]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
