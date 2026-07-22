/**
 * Route Handler: /api/platform/overview
 *
 * GET -> NestJS GET /platform/overview  (cross-tenant health aggregate)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/platform/overview');
