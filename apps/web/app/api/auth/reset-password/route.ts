/**
 * POST /api/auth/reset-password
 *
 * Completes a reset with the emailed token + a new password. Deliberately
 * unauthenticated — the token IS the credential, re-validated in full by the
 * API (expiry, single-use, and the effective password policy). Policy / expiry
 * rejections come back phrased for display, so they are forwarded verbatim.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient, ApiError, apiErrorBody } from '@/lib/api-client';

interface ResetPasswordBody {
  token: string;
  newPassword: string;
  mfaCode?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword, mfaCode }: ResetPasswordBody = await req.json();

    const res = await apiClient.post<{ success?: boolean; message?: string }>(
      '/auth/reset-password',
      { token, newPassword, ...(mfaCode ? { mfaCode } : {}) },
    );

    return NextResponse.json({ success: true, message: res?.message });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(apiErrorBody(err.message, err.internalMessage), {
        status: err.status,
      });
    }
    console.error('[auth/reset-password] unhandled error:', err);
    return NextResponse.json(
      apiErrorBody(
        'Internal server error',
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      ),
      { status: 500 },
    );
  }
}
