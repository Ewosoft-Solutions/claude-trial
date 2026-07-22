/**
 * Route Handler: /api/platform/risk
 *
 * GET -> NestJS GET /platform/risk  (at-risk/misconfigured tenants; platform.metrics)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/platform/risk');
