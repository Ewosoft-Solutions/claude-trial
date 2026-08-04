/** GET /api/roles/[id]/affected → NestJS GET /roles/:id/affected (WB1-5). */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/roles/${encodeURIComponent(id)}/affected`);
}
