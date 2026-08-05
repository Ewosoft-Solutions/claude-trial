/**
 * Route Handlers for /api/campuses — proxy to NestJS /campuses (WB1-6).
 * GET lists the tenant's campuses (scope targets); POST creates one.
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export function GET(req: NextRequest) {
  return proxyGet(req, '/campuses');
}

export function POST(req: NextRequest) {
  return proxyPost(req, '/campuses');
}
