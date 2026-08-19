/**
 * Route Handler: /api/finance/receipts
 *
 * GET  /api/finance/receipts  → NestJS GET /finance/receipts
 * POST /api/finance/receipts  → NestJS POST /finance/receipts (family checkout)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/finance/receipts');
export const POST = (req: NextRequest) => proxyPost(req, '/finance/receipts');
