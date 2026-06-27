/**
 * POST /api/auth/logout
 *
 * Calls /auth/logout on the backend (blacklists the access token) then
 * clears both httpOnly auth cookies.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiClient } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  makeClearCookie,
} from '@/lib/auth-cookies';

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (accessToken) {
    try {
      await apiClient.post('/auth/logout', {}, { Authorization: `Bearer ${accessToken}` });
    } catch {
      // best-effort; clear cookies regardless
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.append('Set-Cookie', makeClearCookie(COOKIE_ACCESS_TOKEN));
  response.headers.append('Set-Cookie', makeClearCookie(COOKIE_REFRESH_TOKEN));

  return response;
}
