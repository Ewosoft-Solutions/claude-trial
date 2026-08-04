/** GET /api/roles/[id]/effective-access → NestJS GET /roles/:id/effective-access. */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/roles/${encodeURIComponent(id)}/effective-access`);
}
