/**
 * Route Handler: /api/ai/analytics/sessions
 *
 * GET → NestJS GET /ai/analytics/sessions (the caller's own analytics
 * chat sessions, newest first).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/ai/analytics/sessions');
