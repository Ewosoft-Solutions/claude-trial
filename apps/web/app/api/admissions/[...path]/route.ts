/**
 * Route handlers for /api/admissions/* — proxy to the NestJS WB3 admissions
 * controller (@Controller('admissions')). Forwards applications + the pipeline
 * sub-routes (advance / reviews / offer / accept / reject / convert); permissions
 * are enforced server-side.
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPatch, proxyPost, proxyPut } from '@/lib/api-proxy';

async function upstreamPath(
  params: Promise<{ path?: string[] }>,
): Promise<string> {
  const { path = [] } = await params;
  return `/admissions/${path.map(encodeURIComponent).join('/')}`;
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

// WB3-3 form-response upsert uses PUT (capture / update an application's answers).
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyPut(req, await upstreamPath(ctx.params));
}
