/**
 * Route Handler: /api/tenant/[id]/invitations/[invitationId]
 *
 * DELETE -> NestJS DELETE /tenant/:id/invitations/:invitationId  (revoke)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

function auth(req: NextRequest): Record<string, string> {
  const token = getBearerFromCookies(req.headers.get('cookie'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  try {
    const { id, invitationId } = await params;
    const data = await apiClient.delete(
      `/tenant/${id}/invitations/${invitationId}`,
      auth(req),
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
