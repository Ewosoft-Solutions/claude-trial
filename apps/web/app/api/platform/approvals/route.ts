/**
 * Route Handler: /api/platform/approvals
 *
 * GET -> NestJS GET /tenant/approvals/pending  (pending tenant-action requests)
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/tenant/approvals/pending');
