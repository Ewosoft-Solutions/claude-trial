/**
 * Route Handler: /api/library
 *
 * GET  /api/library?status=...&category=...  → NestJS GET /library/books
 * POST /api/library                          → NestJS POST /library/books
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/library/books');
export const POST = (req: NextRequest) => proxyPost(req, '/library/books');
