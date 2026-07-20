/**
 * Route Handler: /api/ai/admin/usage
 *
 * GET -> NestJS GET /ai/admin/usage (tenant AI usage governance summary).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/ai/admin/usage');
