/**
 * Route Handler: /api/finance/invoices/[id]/header
 *
 * PATCH → NestJS PATCH /finance/invoices/:id/header
 *
 * Corrects a draft's own details (term, due date, notes). Separate from the
 * sibling `PATCH /finance/invoices/:id`, which issues and is step-up-gated.
 */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(req, `/finance/invoices/${encodeURIComponent(id)}/header`);
}
