/**
 * Route Handler: GET /api/directory/people/[id]/account
 * Proxies to NestJS GET /directory/people/:id/account — the account/access
 * state the People workbench shows on a person detail (WB1-3).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/directory/people/${encodeURIComponent(id)}/account`);
}
