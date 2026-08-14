/**
 * Route Handler: /api/nav/counts
 *
 * GET -> NestJS GET /nav/counts  (lean tenant-scoped sidebar badge counts)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/nav/counts');
