/**
 * Route Handler: /api/health
 *
 * GET /api/health?status=...  → NestJS GET /health/records
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

function authHeader(req: NextRequest): Record<string, string> {
  const token = getBearerFromCookies(req.headers.get('cookie'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ records: [], mock: true });
  }
  try {
    const qs = req.nextUrl.searchParams.toString();
    const data = await apiClient.get(`/health/records${qs ? `?${qs}` : ''}`, authHeader(req));
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
