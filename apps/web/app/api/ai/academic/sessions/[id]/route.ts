/**
 * Route Handler: /api/ai/academic/sessions/[id]
 *
 * GET → NestJS GET /ai/academic/sessions/:id (one owned tutor session with
 * its messages). Next 15 async params.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/ai/academic/sessions/${encodeURIComponent(id)}`);
}
