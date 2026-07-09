/**
 * Route Handler: /api/ai/admin/settings/change-requests/[id]
 *
 * POST { decision: 'approve' | 'reject', reason? } ->
 *   NestJS POST /ai/admin/settings/change-requests/:id/(approve|reject)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const auth: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const body = (await req.json()) as { decision?: string; reason?: string };
    const action = body.decision === 'reject' ? 'reject' : 'approve';
    const data = await apiClient.post(
      `/ai/admin/settings/change-requests/${encodeURIComponent(id)}/${action}`,
      { reason: body.reason },
      auth,
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
