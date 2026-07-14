/**
 * Route Handler: /api/learning/materials/[id]/reprocess
 *
 * POST → NestJS POST /learning/materials/:id/reprocess (re-queue
 * extraction + embedding, e.g. after adding the Voyage key).
 *
 * A trigger with no request body — it always forwards `{}`. Uses the shared
 * auth/error primitives but not proxyPost, since the upstream path is derived
 * from the route param and the body is fixed rather than forwarded.
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';
import { apiErrorResponse, bearerAuthHeaders } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await apiClient.post(
      `/learning/materials/${encodeURIComponent(id)}/reprocess`,
      {},
      bearerAuthHeaders(req),
    );
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
