/**
 * Route Handler: /api/finance/payments
 *
 * GET  /api/finance/payments?invoiceId=...&from=...  → NestJS GET /finance/payments
 * POST /api/finance/payments                         → NestJS POST /finance/payments
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/finance/payments');
export const POST = (req: NextRequest) => proxyPost(req, '/finance/payments');
