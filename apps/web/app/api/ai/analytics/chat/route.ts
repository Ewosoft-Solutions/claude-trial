/**
 * Route Handler: /api/ai/analytics/chat
 *
 * POST → NestJS POST /ai/analytics/chat, piping the SSE stream through
 * untouched (events: session, delta, tool, complete, error, done).
 * Upstream failures that happen BEFORE the stream opens (401/403/429…)
 * surface as plain JSON errors — the client checks `res.ok` before it
 * starts reading events.
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

  const upstream = await fetch(`${API_BASE}/ai/analytics/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: await req.text(),
    // The LLM round-trip is long; never cache, never dedupe.
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    let message = 'AI request failed';
    try {
      const body = (await upstream.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      // keep the generic message
    }
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  return new Response(upstream.body, { headers: SSE_HEADERS });
}
