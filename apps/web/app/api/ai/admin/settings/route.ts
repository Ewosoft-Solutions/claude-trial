/**
 * Route Handler: /api/ai/admin/settings
 *
 * GET  -> NestJS GET  /ai/admin/settings              (current sanitized settings)
 * POST -> NestJS POST /ai/admin/settings/change-request (propose a change)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/ai/admin/settings');
// Proposing a change returns the created change-request with a 200, not a 201.
export const POST = (req: NextRequest) =>
  proxyPost(req, '/ai/admin/settings/change-request', { status: 200 });
