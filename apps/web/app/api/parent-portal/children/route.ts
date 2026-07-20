/**
 * Route Handler: /api/parent-portal/children
 *
 * GET /api/parent-portal/children → NestJS GET /parent-portal/children
 *
 * Proxies the guardian-scoped children summary (identity + real
 * attendance/grade/fee aggregates) for the signed-in parent profile.
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';
import {
  apiErrorResponse,
  bearerAuthHeaders,
  withAccessRefresh,
} from '@/lib/api-proxy';
import { attachRefreshedAccess } from '@/lib/server-refresh';

export async function GET(req: NextRequest) {
  try {
    const { value: data, refreshed } = await withAccessRefresh(
      req,
      (accessToken) =>
        apiClient.get(
          '/parent-portal/children',
          bearerAuthHeaders(req, accessToken),
        ),
    );
    return attachRefreshedAccess(
      NextResponse.json({ children: data }),
      refreshed,
    );
  } catch (err) {
    return apiErrorResponse(err);
  }
}
