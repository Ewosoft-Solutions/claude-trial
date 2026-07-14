/**
 * Route Handler: /api/ai/analytics/sessions/[id]
 *
 * GET → NestJS GET /ai/analytics/sessions/:id (one owned session with
 * its messages, for resume).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/ai/analytics/sessions/${encodeURIComponent(id)}`);
}
