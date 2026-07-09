/**
 * Route Handler: /api/learning/lessons/[id]/materials
 *
 * GET  → NestJS GET  /learning/lessons/:id/materials (with extraction status)
 * POST → NestJS POST /learning/lessons/:id/materials (multipart upload —
 *        the FormData body is forwarded as-is so the file streams through).
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_BASE, ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

function authHeaders(req: NextRequest): Record<string, string> {
  const token = getBearerFromCookies(req.headers.get('cookie'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }
  const { id } = await params;
  try {
    const data = await apiClient.get(
      `/learning/lessons/${encodeURIComponent(id)}/materials`,
      authHeaders(req),
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
    const res = await fetch(
      `${API_BASE}/learning/lessons/${encodeURIComponent(id)}/materials`,
      { method: 'POST', headers: authHeaders(req), body: formData },
    );
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
      return NextResponse.json({ error: message }, { status: res.status });
    }
    return NextResponse.json(payload, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
