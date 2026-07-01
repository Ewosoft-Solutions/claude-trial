/**
 * Route Handler: /api/parent-portal/children
 *
 * GET /api/parent-portal/children → NestJS GET /parent-portal/children
 *
 * Proxies the guardian-scoped children summary (identity + real
 * attendance/grade/fee aggregates) for the signed-in parent profile.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function GET(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ children: [], mock: true });
  }

  const token = getBearerFromCookies(req.headers.get('cookie'));
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const data = await apiClient.get('/parent-portal/children', {
      Authorization: `Bearer ${token}`,
    });
    return NextResponse.json({ children: data });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
