/**
 * Route Handler: POST /api/access/grants/[requestId]/approve — proxy to NestJS
 * POST /access/grants/:requestId/approve (WB1-6): a second approver applies a
 * pending high-risk grant (maker ≠ checker enforced server-side).
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
    `/access/grants/${encodeURIComponent(requestId)}/approve`,
    { status: 200 },
  );
}
