/**
 * POST /api/auth/request-password-reset
 *
 * Starts the "forgot password" flow: the API emails a reset link when the
 * address matches an account. Deliberately unauthenticated. The API reports
 * success even for unknown addresses (anti-enumeration) and may echo the token
 * in dev — so this proxy NEVER forwards the upstream body, only `{ success }`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient, ApiError, apiErrorBody } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json(apiErrorBody('Email is required'), {
        status: 400,
      });
    }

    await apiClient.post('/auth/request-password-reset', { email });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) {
      // Surface real, actionable errors (e.g. rate limiting); the API already
      // returns success for unknown emails, so this isn't an enumeration leak.
      return NextResponse.json(apiErrorBody(err.message, err.internalMessage), {
        status: err.status,
      });
    }
    console.error('[auth/request-password-reset] unhandled error:', err);
    return NextResponse.json(
      apiErrorBody(
        'Unable to start password reset. Please try again.',
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      ),
      { status: 500 },
    );
  }
}
