/**
 * Route Handler: /api/invitations/[token]  (public — no auth)
 *
 * GET -> NestJS GET /tenant/invitations/:token  (invitation preview)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const data = await apiClient.get(
      `/tenant/invitations/${encodeURIComponent(token)}`,
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
