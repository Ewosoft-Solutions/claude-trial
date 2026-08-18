/**
 * Route Handler: /api/learning/chapters
 *
 * GET  → NestJS GET  /learning/chapters (optionally ?curriculumSubjectId=)
 * POST → NestJS POST /learning/chapters
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/learning/chapters');
export const POST = (req: NextRequest) => proxyPost(req, '/learning/chapters');
