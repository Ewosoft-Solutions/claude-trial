/**
 * Route Handler: /api/platform/schools/[id]/status
 *
 * PATCH -> NestJS PATCH /tenant/:id/status  (activate / suspend a school)
 */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(req, `/tenant/${id}/status`);
}
