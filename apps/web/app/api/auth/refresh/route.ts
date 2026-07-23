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
  clearAuthCookie,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  setAuthCookie,
} from '@/lib/auth-cookies';
import { isTerminalRefreshFailure } from '@/lib/refresh-error';

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

    const response = NextResponse.json({
      success: true,
      accessExpiresAt: Date.now() + res.expiresIn * 1000,
    });
    setAuthCookie(
      response,
      COOKIE_ACCESS_TOKEN,
      res.accessToken,
      res.expiresIn,
    );

    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      if (!isTerminalRefreshFailure(err.status)) {
        return NextResponse.json(
          { error: 'Session refresh is temporarily unavailable' },
          { status: err.status },
        );
      }
      // Refresh credential is invalid — clear both cookies.
      const response = NextResponse.json(
        { error: 'Session expired' },
        { status: 401 },
      );
      clearAuthCookie(response, COOKIE_ACCESS_TOKEN);
      clearAuthCookie(response, COOKIE_REFRESH_TOKEN);
      return response;
    }
    console.error('[auth/refresh]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
