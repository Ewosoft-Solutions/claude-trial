/**
 * Route Handler: /api/transport
 *
 * GET  /api/transport?status=...&routeName=...  → NestJS GET /transport/assignments
 * POST /api/transport                           → NestJS POST /transport/assignments
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/transport/assignments');
export const POST = (req: NextRequest) => proxyPost(req, '/transport/assignments');
