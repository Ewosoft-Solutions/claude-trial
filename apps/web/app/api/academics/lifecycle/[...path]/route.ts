/**
 * Route handlers for /api/academics/lifecycle/* — proxy to the NestJS WB2-3
 * student-lifecycle controller (@Controller('academics/lifecycle')). More
 * specific than the generic /api/academics/[...path] catch-all, so Next.js routes
 * here and forwards to /academics/lifecycle/* (permissions enforced server-side).
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

async function upstreamPath(
  params: Promise<{ path?: string[] }>,
): Promise<string> {
  const { path = [] } = await params;
  return `/academics/lifecycle/${path.map(encodeURIComponent).join('/')}`;
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
