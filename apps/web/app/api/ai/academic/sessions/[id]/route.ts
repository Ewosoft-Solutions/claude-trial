/**
 * Route Handler: /api/ai/academic/sessions/[id]
 *
 * GET → NestJS GET /ai/academic/sessions/:id (one owned tutor session with
 * its messages). Next 15 async params.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const data = await apiClient.get(
      `/ai/academic/sessions/${encodeURIComponent(id)}`,
      token ? { Authorization: `Bearer ${token}` } : {},
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
