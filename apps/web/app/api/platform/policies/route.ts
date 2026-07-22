/**
 * Route Handler: /api/platform/policies
 *
 * GET -> NestJS GET /platform/policies  (cross-tenant policy posture + drift)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/platform/policies');
