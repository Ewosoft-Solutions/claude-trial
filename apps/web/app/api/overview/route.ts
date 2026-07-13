/**
 * Route Handler: /api/overview
 *
 * GET -> NestJS GET /overview/stats  (real tenant-scoped dashboard stats)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function GET(req: NextRequest) {
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const data = await apiClient.get('/overview/stats', headers);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
