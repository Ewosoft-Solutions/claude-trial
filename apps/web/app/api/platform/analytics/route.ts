/**
 * Route Handler: /api/platform/analytics
 *
 * GET -> NestJS GET /platform/analytics  (cross-tenant, aggregate-only; platform.metrics)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/platform/analytics');
