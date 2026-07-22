/**
 * Route Handler: /api/platform/approvals/[requestId]/approve
 *
 * POST -> NestJS POST /tenant/approvals/:requestId/approve
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  return proxyPost(req, `/tenant/approvals/${requestId}/approve`, {
    status: 200,
  });
}
