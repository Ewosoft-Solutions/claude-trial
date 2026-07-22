/**
 * Route Handler: /api/platform/schools/[id]
 *
 * GET -> NestJS GET /tenant/:id  (facet-gated tenant detail: identity always,
 * internals only for a platform.tenants.inspect holder)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/tenant/${id}`);
}
