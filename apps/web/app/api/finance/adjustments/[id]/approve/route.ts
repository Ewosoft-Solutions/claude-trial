/**
 * Route Handler: POST /api/finance/adjustments/[id]/approve
 * Proxies to NestJS POST /finance/adjustments/:id/approve — a second authority
 * approves a pending adjustment (maker ≠ checker, enforced server-side).
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
    `/finance/adjustments/${encodeURIComponent(id)}/approve`,
    {
      status: 200,
    },
  );
}
