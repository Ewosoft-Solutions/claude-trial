/**
 * Route Handler: /api/finance/invoices/[id]
 *
 * GET   → NestJS GET   /finance/invoices/:id  (single invoice + lines/adjustments)
 * PATCH → NestJS PATCH /finance/invoices/:id  (issue / edit; step-up-gated)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPatch } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/finance/invoices/${encodeURIComponent(id)}`);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(req, `/finance/invoices/${encodeURIComponent(id)}`);
}
