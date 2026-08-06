/**
 * Route Handler: POST /api/finance/adjustments/[id]/reject
 * Proxies to NestJS POST /finance/adjustments/:id/reject — a second authority
 * rejects a pending adjustment.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPost(
    req,
    `/finance/adjustments/${encodeURIComponent(id)}/reject`,
    {
      status: 200,
    },
  );
}
