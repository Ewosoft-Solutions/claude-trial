/**
 * DELETE /api/auth/biometrics/devices/[id]
 *
 * Proxy for NestJS DELETE /auth/biometrics/devices/:id — removes an enrolled
 * platform authenticator belonging to the signed-in user.
 */
import { NextRequest } from 'next/server';
import { proxyDelete } from '@/lib/api-proxy';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyDelete(req, `/auth/biometrics/devices/${encodeURIComponent(id)}`);
}
