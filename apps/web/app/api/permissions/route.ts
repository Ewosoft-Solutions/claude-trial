/**
 * GET /api/permissions → NestJS GET /permissions (WB1-5 permission catalog
 * search over resource.action.context). Forwards ?search=&resource=&category=.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  return proxyGet(req, '/permissions');
}
