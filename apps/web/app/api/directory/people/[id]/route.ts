/**
 * Route Handler: GET /api/directory/people/[id]?type=
 * Proxies to NestJS GET /directory/people/:id — the full person detail behind
 * the directory drawer / profile page. The `type` query is forwarded so the
 * server can gate the tab's type permission.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/directory/people/${encodeURIComponent(id)}`);
}
