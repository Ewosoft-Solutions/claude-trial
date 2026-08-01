/**
 * Route Handler: /api/directory/saved-views/[id]
 * PATCH  → NestJS PATCH  /directory/saved-views/:id (owner only)
 * DELETE → NestJS DELETE /directory/saved-views/:id (owner only)
 */
import { NextRequest } from 'next/server';
import { proxyDelete, proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(req, `/directory/saved-views/${encodeURIComponent(id)}`);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyDelete(req, `/directory/saved-views/${encodeURIComponent(id)}`);
}
