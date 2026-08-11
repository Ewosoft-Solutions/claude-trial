/**
 * Same-origin proxy for the UNAUTHENTICATED admissions portal (`/public/*` on
 * the API). Unlike the other `/api/*` proxies this attaches NO session — the
 * applicant has no account. It only forwards the request (and the client IP, so
 * the API's rate-limiter sees the real caller) and relays the response. Keeping
 * it same-origin avoids CORS on the public surface.
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-client';

async function forward(
  req: NextRequest,
  params: Promise<{ path?: string[] }>,
  method: 'GET' | 'POST',
): Promise<NextResponse> {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API not configured' }, { status: 500 });
  }
  const { path = [] } = await params;
  const upstream = `${API_BASE}/public/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const fwd =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';
  if (fwd) headers['x-forwarded-for'] = fwd;

  const res = await fetch(upstream, {
    method,
    headers,
    body: method === 'GET' ? undefined : await req.text(),
    cache: 'no-store',
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return forward(req, ctx.params, 'GET');
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return forward(req, ctx.params, 'POST');
}
