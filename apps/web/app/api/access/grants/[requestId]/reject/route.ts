/**
 * Route Handler: POST /api/access/grants/[requestId]/reject — proxy to NestJS
 * POST /access/grants/:requestId/reject (WB1-6): reject a pending high-risk grant.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  return proxyPost(
    req,
    `/access/grants/${encodeURIComponent(requestId)}/reject`,
    { status: 200 },
  );
}
