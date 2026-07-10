/**
 * Route Handler: /api/tenant/features
 *
 * GET   -> NestJS GET   /tenant/features  (current tenant feature toggles)
 * PATCH -> NestJS PATCH /tenant/features  (toggle modules)
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
    const data = await apiClient.get('/tenant/features', auth(req));
    return NextResponse.json(data);
  } catch (err) {
    return toError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiClient.patch('/tenant/features', body, auth(req));
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
