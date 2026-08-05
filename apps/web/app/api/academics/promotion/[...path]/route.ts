/**
 * Route handlers for /api/academics/promotion/* — proxy to the NestJS WB2-4
 * promotion controller (@Controller('academics/promotion')). More specific than
 * the generic /api/academics/[...path] catch-all, so Next.js routes here and
 * forwards to /academics/promotion/* (permissions enforced server-side).
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

async function upstreamPath(
  params: Promise<{ path?: string[] }>,
): Promise<string> {
  const { path = [] } = await params;
  return `/academics/promotion/${path.map(encodeURIComponent).join('/')}`;
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
