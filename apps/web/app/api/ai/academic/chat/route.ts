/**
 * Route Handler: /api/ai/academic/chat
 *
 * POST → NestJS POST /ai/academic/chat, piping the SSE stream through
 * untouched (events: session, sources, delta, complete, error, done).
 * Pre-stream failures surface as JSON the client checks via `res.ok`. A 403
 * is the assessment-window block — its body ({ allowed, message, alternatives })
 * is forwarded verbatim so the client can render the refusal + alternatives.
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export async function POST(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  const token = getBearerFromCookies(req.headers.get('cookie'));
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(`${API_BASE}/ai/academic/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: await req.text(),
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    // Forward the upstream JSON (the 403 assessment block, or an error) so
    // the client can show the message and any alternatives.
    let body: unknown = { error: 'Tutor request failed' };
    try {
      body = await upstream.json();
    } catch {
      // keep the generic error
    }
    return NextResponse.json(body, { status: upstream.status });
  }

  return new Response(upstream.body, { headers: SSE_HEADERS });
}
