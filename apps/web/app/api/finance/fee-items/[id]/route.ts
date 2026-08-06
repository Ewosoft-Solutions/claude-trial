/**
 * Route Handler: PATCH /api/finance/fee-items/[id]
 * Proxies to NestJS PATCH /finance/fee-items/:id — edit a fee item
 * (name / default amount / active).
 */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(req, `/finance/fee-items/${encodeURIComponent(id)}`);
}
