/**
 * Route Handler: /api/learning/lessons
 *
 * GET  → NestJS GET  /learning/lessons (optionally ?classId=&status=)
 * POST → NestJS POST /learning/lessons (create a lesson)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/learning/lessons');
export const POST = (req: NextRequest) => proxyPost(req, '/learning/lessons');
