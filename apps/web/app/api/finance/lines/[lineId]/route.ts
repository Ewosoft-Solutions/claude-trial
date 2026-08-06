/**
 * Route Handler: /api/finance/lines/[lineId]
 *
 * PATCH  → NestJS PATCH  /finance/lines/:lineId  (edit an invoice line)
 * DELETE → NestJS DELETE /finance/lines/:lineId  (remove an invoice line)
 */
import { NextRequest } from 'next/server';
import { proxyDelete, proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const { lineId } = await params;
  return proxyPatch(req, `/finance/lines/${encodeURIComponent(lineId)}`);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const { lineId } = await params;
  return proxyDelete(req, `/finance/lines/${encodeURIComponent(lineId)}`);
}
