/**
 * Route Handler: /api/finance/invoices/[id]/shared
 *
 * POST → NestJS POST /finance/invoices/:id/shared
 *
 * Records that the document was sent to someone. Rendering the PDF is not
 * sharing it, so only this is written to the audit trail.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPost(req, `/finance/invoices/${encodeURIComponent(id)}/shared`);
}
