/**
 * Route Handler: /api/finance/fee-items
 *
 * GET  /api/finance/fee-items  → NestJS GET  /finance/fee-items  (list catalogue)
 * POST /api/finance/fee-items  → NestJS POST /finance/fee-items  (add fee item)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/finance/fee-items');
export const POST = (req: NextRequest) => proxyPost(req, '/finance/fee-items');
