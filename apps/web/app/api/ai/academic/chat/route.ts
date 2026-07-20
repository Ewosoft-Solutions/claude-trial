/**
 * Route Handler: /api/ai/academic/chat
 *
 * POST → NestJS POST /ai/academic/chat, piping the SSE stream through
 * untouched (events: session, sources, delta, complete, error, done).
 * Pre-stream failures surface as JSON the client checks via `res.ok`. A 403
 * is the assessment-window block — its body ({ allowed, message, alternatives })
 * is forwarded verbatim (forwardErrorBody) so the client can render the refusal.
 */
import { NextRequest } from 'next/server';
import { proxyStream } from '@/lib/api-proxy';

export const POST = (req: NextRequest) =>
  proxyStream(req, '/ai/academic/chat', {
    errorMessage: 'Tutor request failed',
    forwardErrorBody: true,
  });
