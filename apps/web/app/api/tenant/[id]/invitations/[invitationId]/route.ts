/**
 * Route Handler: /api/tenant/[id]/invitations/[invitationId]
 *
 * DELETE -> NestJS DELETE /tenant/:id/invitations/:invitationId  (revoke)
 */
import { NextRequest } from 'next/server';
import { proxyDelete } from '@/lib/api-proxy';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const { id, invitationId } = await params;
  return proxyDelete(req, `/tenant/${id}/invitations/${invitationId}`);
}
