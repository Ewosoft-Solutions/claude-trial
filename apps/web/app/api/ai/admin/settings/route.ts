/**
 * Route Handler: /api/ai/admin/settings
 *
 * GET  -> NestJS GET  /ai/admin/settings              (current sanitized settings)
 * POST -> NestJS POST /ai/admin/settings/change-request (propose a change)
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
    const data = await apiClient.get('/ai/admin/settings', auth(req));
    return NextResponse.json(data);
  } catch (err) {
    return toError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiClient.post(
      '/ai/admin/settings/change-request',
      body,
      auth(req),
    );
    return NextResponse.json(data);
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
