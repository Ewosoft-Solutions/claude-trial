/**
 * Route Handler: PATCH /api/guardianships/[id]
 * Proxies to NestJS PATCH /guardianships/:id — update authority / consent /
 * priority on a guardian relationship (WB1-4).
 */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(req, `/guardianships/${encodeURIComponent(id)}`);
}
