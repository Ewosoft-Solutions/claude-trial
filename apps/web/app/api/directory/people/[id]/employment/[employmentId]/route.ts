/**
 * Route Handler: PATCH /api/directory/people/[id]/employment/[employmentId]
 * Proxies to NestJS PATCH /directory/people/:id/employment/:employmentId
 * (WB1-2) — update an employment's details / status / reporting line.
 */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; employmentId: string }> },
) {
  const { id, employmentId } = await params;
  return proxyPatch(
    req,
    `/directory/people/${encodeURIComponent(id)}/employment/${encodeURIComponent(employmentId)}`,
  );
}
