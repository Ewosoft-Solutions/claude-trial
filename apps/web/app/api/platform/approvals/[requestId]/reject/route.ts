/**
 * Route Handler: /api/platform/approvals/[requestId]/reject
 *
 * POST -> NestJS POST /tenant/approvals/:requestId/reject
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  return proxyPost(req, `/tenant/approvals/${requestId}/reject`, {
    status: 200,
  });
}
