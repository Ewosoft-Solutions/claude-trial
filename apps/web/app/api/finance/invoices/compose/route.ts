/**
 * Route Handler: /api/finance/invoices/compose
 *
 * POST → NestJS POST /finance/invoices/compose
 *
 * Writes an invoice composed in the browser — header, lines, and optionally
 * the issue — in one step-up-gated request. One call, because the step-up
 * challenge is consumed by the guard that verifies it.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(req: NextRequest) {
  return proxyPost(req, '/finance/invoices/compose');
}
