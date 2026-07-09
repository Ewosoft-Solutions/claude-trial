/**
 * Route Handler: /api/learning/materials/[id]/reprocess
 *
 * POST → NestJS POST /learning/materials/:id/reprocess (re-queue
 * extraction + embedding, e.g. after adding the Voyage key).
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_BASE, ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }
  const { id } = await params;
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const data = await apiClient.post(
      `/learning/materials/${encodeURIComponent(id)}/reprocess`,
      {},
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
