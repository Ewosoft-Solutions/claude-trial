import 'server-only';

import type { NextRequest } from 'next/server';

import { apiClient } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  makeSetCookie,
} from '@/lib/auth-cookies';

interface RefreshApiResponse {
  accessToken: string;
  expiresIn: number;
}

export interface RefreshedAccess {
  accessToken: string;
  accessExpiresAt: number;
  setCookie: string;
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
      accessExpiresAt: Date.now() + result.expiresIn * 1000,
      setCookie: makeSetCookie(
        COOKIE_ACCESS_TOKEN,
        result.accessToken,
        result.expiresIn,
      ),
    };
  } catch {
    return null;
  }
}

export function attachRefreshedAccess(
  response: Response,
  refreshed: RefreshedAccess | null,
): Response {
  if (refreshed) response.headers.append('Set-Cookie', refreshed.setCookie);
  return response;
}
