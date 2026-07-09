import { NextRequest, NextResponse } from 'next/server';

import { API_BASE } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

const ALLOWED_ROOTS = new Set([
  'assessments',
  'classes',
  'courses',
  'learning',
  'questions',
]);

const JSON_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function proxyAcademics(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const root = path[0];

  if (!root || !ALLOWED_ROOTS.has(root)) {
    return jsonError('Academic endpoint is not allowed', 404);
  }

  if (!API_BASE) {
    return jsonError('API not configured', 503);
  }

  const token = getBearerFromCookies(req.headers.get('cookie'));
  if (!token) return jsonError('Unauthorized', 401);

  const upstreamPath = path.map(encodeURIComponent).join('/');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let body: BodyInit | undefined;
  if (JSON_METHODS.has(req.method)) {
    headers['Content-Type'] = req.headers.get('content-type') ?? 'application/json';
    body = await req.text();
  }

  const upstream = await fetch(`${API_BASE}/${upstreamPath}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  const disposition = upstream.headers.get('content-disposition');
  if (contentType) responseHeaders.set('content-type', contentType);
  if (disposition) responseHeaders.set('content-disposition', disposition);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyAcademics;
export const POST = proxyAcademics;
export const PUT = proxyAcademics;
export const PATCH = proxyAcademics;
export const DELETE = proxyAcademics;
