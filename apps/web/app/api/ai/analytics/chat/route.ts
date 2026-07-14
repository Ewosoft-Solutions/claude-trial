/**
 * Route Handler: /api/ai/analytics/chat
 *
 * POST → NestJS POST /ai/analytics/chat, piping the SSE stream through
 * untouched (events: session, delta, tool, complete, error, done).
 * Upstream failures that happen BEFORE the stream opens (401/403/429…)
 * surface as plain JSON errors — the client checks `res.ok` before it
 * starts reading events.
 */
import { NextRequest } from 'next/server';
import { proxyStream } from '@/lib/api-proxy';

export const POST = (req: NextRequest) => proxyStream(req, '/ai/analytics/chat');
