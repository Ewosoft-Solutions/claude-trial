/**
 * Route Handler: /api/ai/admin/settings/change-requests/[id]
 *
 * POST { decision: 'approve' | 'reject', reason? } ->
 *   NestJS POST /ai/admin/settings/change-requests/:id/(approve|reject)
 *
 * The decision selects the upstream action segment, so this reuses the shared
 * auth/error primitives rather than proxyPost.
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';
import { apiErrorResponse, bearerAuthHeaders } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { decision?: string; reason?: string };
    const action = body.decision === 'reject' ? 'reject' : 'approve';
    const data = await apiClient.post(
      `/ai/admin/settings/change-requests/${encodeURIComponent(id)}/${action}`,
      { reason: body.reason },
      bearerAuthHeaders(req),
    );
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
