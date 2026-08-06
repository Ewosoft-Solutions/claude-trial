/**
 * Route Handler: /api/finance/invoices/[id]/lines
 *
 * GET  → NestJS GET  /finance/invoices/:id/lines  (list an invoice's lines)
 * POST → NestJS POST /finance/invoices/:id/lines  (add a line)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/finance/invoices/${encodeURIComponent(id)}/lines`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPost(req, `/finance/invoices/${encodeURIComponent(id)}/lines`);
}
