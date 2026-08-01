/**
 * Route Handler: /api/directory/saved-views
 * GET  → NestJS GET  /directory/saved-views?resource=… (own + shared views)
 * POST → NestJS POST /directory/saved-views (save the current view)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/directory/saved-views');

export const POST = (req: NextRequest) =>
  proxyPost(req, '/directory/saved-views');
