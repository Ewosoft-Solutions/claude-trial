import { NextRequest, NextResponse } from 'next/server';

import { API_BASE } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';
import {
  attachRefreshedAccess,
  refreshAccessForRequest,
  type RefreshedAccess,
} from '@/lib/server-refresh';

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

  let token = getBearerFromCookies(req.headers.get('cookie'));
  let refreshed: RefreshedAccess | null = null;
  if (!token) {
    refreshed = await refreshAccessForRequest(req);
    if (!refreshed) return jsonError('Unauthorized', 401);
    token = refreshed.accessToken;
  }

  const upstreamPath = path.map(encodeURIComponent).join('/');
  let body: string | undefined;
  if (JSON_METHODS.has(req.method)) {
    body = await req.text();
  }

  const requestUpstream = (accessToken: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (body !== undefined) {
      headers['Content-Type'] =
        req.headers.get('content-type') ?? 'application/json';
    }
    return fetch(`${API_BASE}/${upstreamPath}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    });
  };

  let upstream = await requestUpstream(token);
  if (upstream.status === 401) {
    const retryAccess = await refreshAccessForRequest(req);
    if (retryAccess) {
      refreshed = retryAccess;
      upstream = await requestUpstream(retryAccess.accessToken);
    }
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  const disposition = upstream.headers.get('content-disposition');
  if (contentType) responseHeaders.set('content-type', contentType);
  if (disposition) responseHeaders.set('content-disposition', disposition);

  return attachRefreshedAccess(
    new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    }),
    refreshed,
  );
}

export const GET = proxyAcademics;
export const POST = proxyAcademics;
export const PUT = proxyAcademics;
export const PATCH = proxyAcademics;
export const DELETE = proxyAcademics;
