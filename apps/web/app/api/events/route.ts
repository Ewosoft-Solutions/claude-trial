/**
 * Route Handler: /api/events
 *
 * GET  /api/events?status=...&eventType=...  → NestJS GET /events
 * POST /api/events                           → NestJS POST /events
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/events');
export const POST = (req: NextRequest) => proxyPost(req, '/events');
