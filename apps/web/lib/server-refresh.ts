import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';

import { apiClient } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  setAuthCookie,
} from '@/lib/auth-cookies';

interface RefreshApiResponse {
  accessToken: string;
  expiresIn: number;
  // Refresh tokens now rotate: each refresh returns a fresh refresh token whose
  // lifetime is the REMAINING time on the fixed 7-day session (never extended).
  // Persist it or the next refresh replays a retired token → reuse detection.
  refreshToken: string;
  refreshExpiresIn: number;
}

export interface RefreshedAccess {
  accessToken: string;
  accessMaxAge: number;
  refreshToken: string;
  refreshMaxAge: number;
}

/** Exchange the request's refresh cookie directly with NestJS. */
export async function refreshAccessForRequest(
  req: NextRequest,
): Promise<RefreshedAccess | null> {
  const refreshToken = req.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!refreshToken) return null;

  try {
    const result = await apiClient.post<RefreshApiResponse>('/auth/refresh', {
      refreshToken,
    });
    return {
      accessToken: result.accessToken,
      accessMaxAge: result.expiresIn,
      refreshToken: result.refreshToken,
      refreshMaxAge: result.refreshExpiresIn,
    };
  } catch {
    return null;
  }
}

/**
 * Persist a refreshed access + rotated refresh token onto an outgoing response.
 *
 * Both cookies go through `cookies.set` (Next's serializer keeps each cookie a
 * distinct Set-Cookie header). We deliberately do NOT `headers.append('Set-Cookie',
 * …)` twice: appending more than one Set-Cookie header on a single response drops
 * the first (see the note in auth-cookies.ts — it caused a login loop on demo).
 *
 * Requires a `NextResponse` for the cookie jar; the two call sites that used to
 * pass a bare `Response` (the SSE stream proxy and the academics binary
 * passthrough) now construct a `NextResponse` instead.
 */
export function attachRefreshedAccess(
  response: NextResponse,
  refreshed: RefreshedAccess | null,
): NextResponse {
  if (refreshed) {
    setAuthCookie(
      response,
      COOKIE_ACCESS_TOKEN,
      refreshed.accessToken,
      refreshed.accessMaxAge,
    );
    setAuthCookie(
      response,
      COOKIE_REFRESH_TOKEN,
      refreshed.refreshToken,
      refreshed.refreshMaxAge,
    );
  }
  return response;
}
