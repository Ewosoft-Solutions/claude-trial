/**
 * Route Handler: /api/invitations/accept  (public — no auth)
 *
 * POST -> NestJS POST /tenant/invitations/accept  (set password, activate)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiClient.post('/tenant/invitations/accept', body);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
