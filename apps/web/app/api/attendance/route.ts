/**
 * Route Handler: /api/attendance
 *
 * Proxies attendance reads + bulk saves to the NestJS backend,
 * attaching the access-token cookie as a Bearer header so the client
 * doesn't need to handle httpOnly cookies directly.
 *
 * GET  /api/attendance?classId=...&date=...   → NestJS GET /attendance
 * POST /api/attendance                        → NestJS POST /attendance/bulk
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
    const data = await apiClient.get(`/attendance${qs ? `?${qs}` : ''}`, authHeader(req));
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ saved: 0, mock: true });
  }
  try {
    const body: unknown = await req.json();
    const data = await apiClient.post('/attendance/bulk', body, authHeader(req));
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
