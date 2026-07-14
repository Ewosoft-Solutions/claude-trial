/**
 * Route Handler: /api/tenant/[id]/invitations
 *
 * GET  -> NestJS GET  /tenant/:id/invitations   (list invitations)
 * POST -> NestJS POST /tenant/:id/invitations   (create invitation)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/tenant/${id}/invitations`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPost(req, `/tenant/${id}/invitations`);
}
