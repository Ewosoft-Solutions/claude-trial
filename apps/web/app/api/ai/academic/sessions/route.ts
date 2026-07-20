/**
 * Route Handler: /api/ai/academic/sessions
 *
 * GET → NestJS GET /ai/academic/sessions (the caller's own tutor sessions,
 * newest first, with lesson labels).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/ai/academic/sessions');
