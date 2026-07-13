/**
 * Route Handler: /api/platform/schools
 *
 * GET  -> NestJS GET  /tenant           (list all schools; platform-scoped)
 * POST -> NestJS POST /tenant/register  (register a new school)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

function auth(req: NextRequest): Record<string, string> {
  const token = getBearerFromCookies(req.headers.get('cookie'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.search ?? '';
    const data = await apiClient.get(`/tenant${qs}`, auth(req));
    return NextResponse.json(data);
  } catch (err) {
    return toError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiClient.post('/tenant/register', body, auth(req));
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return toError(err);
  }
}

function toError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
