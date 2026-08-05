/**
 * Route handlers for /api/academics/structure/* — proxy to the NestJS WB2-1
 * academic-structure controller (@Controller('academics/structure')).
 *
 * This nested route is MORE specific than the generic /api/academics/[...path]
 * catch-all (whose ALLOWED_ROOTS list maps /api/academics/X → NestJS /X), so
 * Next.js routes /api/academics/structure/* here and forwards to the matching
 * /academics/structure/* upstream path (permissions enforced server-side).
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPatch, proxyPost } from '@/lib/api-proxy';

async function upstreamPath(
  params: Promise<{ path?: string[] }>,
): Promise<string> {
  const { path = [] } = await params;
  return `/academics/structure/${path.map(encodeURIComponent).join('/')}`;
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
