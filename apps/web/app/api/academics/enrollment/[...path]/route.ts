/**
 * Route handlers for /api/academics/enrollment/* — proxy to the NestJS WB2-2
 * enrollment controller (@Controller('academics/enrollment')). More specific
 * than the generic /api/academics/[...path] catch-all, so Next.js routes here
 * and forwards to /academics/enrollment/* (permissions enforced server-side).
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPatch, proxyPost } from '@/lib/api-proxy';

async function upstreamPath(
  params: Promise<{ path?: string[] }>,
): Promise<string> {
  const { path = [] } = await params;
  return `/academics/enrollment/${path.map(encodeURIComponent).join('/')}`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyGet(req, await upstreamPath(ctx.params));
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyPost(req, await upstreamPath(ctx.params), { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyPatch(req, await upstreamPath(ctx.params));
}
