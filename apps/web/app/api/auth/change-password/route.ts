/**
 * POST /api/auth/change-password
 *
 * Completes a forced password rotation for an account that cannot hold a
 * session yet.
 *
 * Deliberately unauthenticated, mirroring the API endpoint it proxies: an
 * account flagged `mustChangePassword` is refused a token at login, so there is
 * no cookie to authenticate with. The current password IS the credential, and
 * the API re-validates it in full — including the lockout check — so this route
 * adds no authorisation of its own and must not be mistaken for a route that
 * does.
 *
 * No cookies are set here. On success the client re-runs the normal sign-in
 * with the new password, which re-enters MFA and school selection as usual;
 * duplicating that here would fork the session-establishing logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient, ApiError, apiErrorBody } from '@/lib/api-client';

interface ChangePasswordBody {
  email: string;
  currentPassword: string;
  newPassword: string;
}

interface ChangePasswordApiResponse {
  success: boolean;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const { email, currentPassword, newPassword }: ChangePasswordBody =
      await req.json();

    const res = await apiClient.post<ChangePasswordApiResponse>(
      '/auth/change-password',
      { email, currentPassword, newPassword },
    );

    return NextResponse.json({ success: res.success, message: res.message });
  } catch (err) {
    if (err instanceof ApiError) {
      // Forward the API's message: rejections here are actionable for the user
      // (policy violations, reuse of the current password, lockout) and the
      // API already phrases them for display.
      return NextResponse.json(apiErrorBody(err.message, err.internalMessage), {
        status: err.status,
      });
    }
    console.error('[auth/change-password] unhandled error:', err);
    return NextResponse.json(
      apiErrorBody(
        'Internal server error',
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      ),
      { status: 500 },
    );
  }
}
