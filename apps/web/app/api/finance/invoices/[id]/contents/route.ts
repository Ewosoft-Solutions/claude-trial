/**
 * Route Handler: /api/finance/invoices/[id]/contents
 *
 * PATCH → NestJS PATCH /finance/invoices/:id/contents
 *
 * Saves a draft edited in the browser — its details and its whole set of lines
 * — in one request. A replace, not a merge: last save wins.
 */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(
    req,
    `/finance/invoices/${encodeURIComponent(id)}/contents`,
  );
}
