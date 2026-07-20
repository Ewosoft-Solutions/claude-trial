/**
 * Route Handler: /api/overview
 *
 * GET -> NestJS GET /overview/stats  (real tenant-scoped dashboard stats)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/overview/stats');
