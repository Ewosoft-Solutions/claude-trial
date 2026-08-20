/**
 * Route Handler: /api/finance/invoices/[id]/pdf
 *
 * GET → NestJS GET /finance/invoices/:id/pdf
 *
 * Streams the rendered document straight through, preserving Content-Type and
 * Content-Disposition so a preview can display it and a download names the
 * file after the invoice.
 */
import { NextRequest } from 'next/server';
import { proxyDownload } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyDownload(req, `/finance/invoices/${encodeURIComponent(id)}/pdf`);
}
