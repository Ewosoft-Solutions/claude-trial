/**
 * Route Handler: POST /api/directory/people/[id]/employment/[employmentId]/disable
 * Proxies to NestJS POST .../employment/:employmentId/disable (WB1-2) — end an
 * employment (status→terminated + end date + reason).
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; employmentId: string }> },
) {
  const { id, employmentId } = await params;
  return proxyPost(
    req,
    `/directory/people/${encodeURIComponent(id)}/employment/${encodeURIComponent(employmentId)}/disable`,
    { status: 200 },
  );
}
