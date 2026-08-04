/**
 * Route Handler: GET /api/directory/people/[id]/employment/managers
 * Proxies to NestJS GET /directory/people/:id/employment/managers (WB1-2) —
 * active staff to pick a reporting line from. Forwards an ?exclude= query.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const exclude = req.nextUrl.searchParams.get('exclude');
  const suffix = exclude ? `?exclude=${encodeURIComponent(exclude)}` : '';
  return proxyGet(
    req,
    `/directory/people/${encodeURIComponent(id)}/employment/managers${suffix}`,
  );
}
