/**
 * Route Handler: /api/learning/lessons/[id]/materials
 *
 * GET  → NestJS GET  /learning/lessons/:id/materials (with extraction status)
 * POST → NestJS POST /learning/lessons/:id/materials (multipart upload —
 *        the FormData body is forwarded as-is so the file streams through).
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-client';
import { proxyGet } from '@/lib/api-proxy';
import { getBearerFromCookies } from '@/lib/server-api';
import {
  attachRefreshedAccess,
  refreshAccessForRequest,
  type RefreshedAccess,
} from '@/lib/server-refresh';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/learning/lessons/${encodeURIComponent(id)}/materials`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }
  const { id } = await params;
  try {
    // Re-wrap the multipart body; fetch derives the boundary header itself.
    const formData = await req.formData();
    let token = getBearerFromCookies(req.headers.get('cookie'));
    let refreshed: RefreshedAccess | null = null;
    if (!token) {
      refreshed = await refreshAccessForRequest(req);
      if (!refreshed) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      token = refreshed.accessToken;
    }

    const upload = (accessToken: string) =>
      fetch(
        `${API_BASE}/learning/lessons/${encodeURIComponent(id)}/materials`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
          cache: 'no-store',
        },
      );

    let res = await upload(token);
    if (res.status === 401 && !refreshed) {
      const retryAccess = await refreshAccessForRequest(req);
      if (retryAccess) {
        refreshed = retryAccess;
        res = await upload(retryAccess.accessToken);
      }
    }
    const body = await res.text();
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = { error: body || 'Upload failed' };
    }
    if (!res.ok) {
      const message =
        (payload as { message?: string; error?: string }).message ??
        (payload as { error?: string }).error ??
        'Upload failed';
      return attachRefreshedAccess(
        NextResponse.json({ error: message }, { status: res.status }),
        refreshed,
      );
    }
    return attachRefreshedAccess(
      NextResponse.json(payload, { status: 201 }),
      refreshed,
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
