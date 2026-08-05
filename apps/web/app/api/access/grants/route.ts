/**
 * Route Handler: POST /api/access/grants — proxy to NestJS POST /access/grants
 * (WB1-6): request a scoped/time-boxed role grant (high-risk → maker-checker).
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export function POST(req: NextRequest) {
  return proxyPost(req, '/access/grants', { status: 200 });
}
