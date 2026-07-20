/**
 * POST /api/auth/passkey/options
 *
 * Proxy for NestJS POST /auth/passkey/login/options — public (the caller isn't
 * signed in yet). Returns WebAuthn authentication options for a passwordless
 * login, or `{ hasPasskey: false }`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiClient, ApiError } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await apiClient.post('/auth/passkey/login/options', {
      email: body?.email,
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
