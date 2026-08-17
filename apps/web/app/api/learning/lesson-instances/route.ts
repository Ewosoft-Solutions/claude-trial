/**
 * Route Handler: /api/learning/lesson-instances
 *
 * POST → NestJS POST /learning/lesson-instances (schedule a library lesson
 * for one class; never a content copy).
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = (req: NextRequest) =>
  proxyPost(req, '/learning/lesson-instances');
