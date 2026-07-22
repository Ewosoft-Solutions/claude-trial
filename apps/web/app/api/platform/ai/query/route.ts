/**
 * Route Handler: /api/platform/ai/query
 *
 * POST -> NestJS POST /platform/ai/query  (platform AI assistant; aggregate-only)
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = (req: NextRequest) =>
  proxyPost(req, '/platform/ai/query', { status: 200 });
