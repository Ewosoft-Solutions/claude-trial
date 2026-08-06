/**
 * Route Handler: POST /api/finance/discount-policies/[id]/activate
 * Proxies to NestJS POST /finance/discount-policies/:id/activate — a second
 * authority activates a pending policy (checker ≠ creator). It then auto-applies
 * to invoices at issue.
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
    `/finance/discount-policies/${encodeURIComponent(id)}/activate`,
    { status: 200 },
  );
}
