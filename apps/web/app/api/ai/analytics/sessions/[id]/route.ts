/**
 * Route Handler: /api/ai/analytics/sessions/[id]
 *
 * GET → NestJS GET /ai/analytics/sessions/:id (one owned session with
 * its messages, for resume).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const data = await apiClient.get(
      `/ai/analytics/sessions/${encodeURIComponent(id)}`,
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
