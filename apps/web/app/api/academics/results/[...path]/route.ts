/**
 * Route handlers for /api/academics/results/* — proxy to the NestJS WB4 results
 * controllers (@Controller('academics/results')). More specific than the generic
 * /api/academics/[...path] catch-all, so Next.js routes here and forwards to
 * /academics/results/* (permissions + maker-checker enforced server-side).
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost, proxyPatch, proxyPut } from '@/lib/api-proxy';

async function upstreamPath(
  params: Promise<{ path?: string[] }>,
): Promise<string> {
  const { path = [] } = await params;
  return `/academics/results/${path.map(encodeURIComponent).join('/')}`;
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
  // Cycle create returns 201; every other POST is an action (200). The service
  // sets its own status, so default to 200 and let create ride through fine.
  return proxyPost(req, await upstreamPath(ctx.params), { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyPatch(req, await upstreamPath(ctx.params));
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyPut(req, await upstreamPath(ctx.params));
}
