/**
 * Route Handler: /api/platform/audit
 *
 * GET -> NestJS GET /platform/audit  (cross-tenant audit query)
 *
 * proxyGet forwards the incoming query string, so tenantId/action/date/page
 * filters pass through automatically.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/platform/audit');
