/**
 * Route Handler: /api/guardianships
 *   GET  → NestJS GET /guardianships (list by ward/guardian; query forwarded)
 *   POST → NestJS POST /guardianships (create a guardian relationship)
 * WB1-4 guardianship management.
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/guardianships');

export const POST = (req: NextRequest) =>
  proxyPost(req, '/guardianships', { status: 201 });
