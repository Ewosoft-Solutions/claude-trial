/** POST /api/roles/[id]/explain → NestJS POST /roles/:id/explain (WB1-5). */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPost(req, `/roles/${encodeURIComponent(id)}/explain`, {
    status: 200,
  });
}
