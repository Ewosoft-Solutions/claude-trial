/**
 * Route Handler: /api/finance/adjustments
 *
 * GET  → NestJS GET  /finance/adjustments  (the approvals queue)
 * POST → NestJS POST /finance/adjustments  (request a discretionary
 *        adjustment; stays pending until a second authority approves it)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

// proxyGet forwards the caller's query string itself — appending it here too
// would send `?status=x?status=x` and fail validation upstream.
export const GET = (req: NextRequest) => proxyGet(req, '/finance/adjustments');

export const POST = (req: NextRequest) =>
  proxyPost(req, '/finance/adjustments');
