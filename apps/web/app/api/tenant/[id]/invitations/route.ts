/**
 * Route Handler: /api/tenant/[id]/invitations
 *
 * GET  -> NestJS GET  /tenant/:id/invitations   (list invitations)
 * POST -> NestJS POST /tenant/:id/invitations   (create invitation)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

function auth(req: NextRequest): Record<string, string> {
  const token = getBearerFromCookies(req.headers.get('cookie'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const qs = req.nextUrl.search ?? '';
    const data = await apiClient.get(
      `/tenant/${id}/invitations${qs}`,
      auth(req),
    );
    return NextResponse.json(data);
  } catch (err) {
    return toError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await apiClient.post(
      `/tenant/${id}/invitations`,
      body,
      auth(req),
    );
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
