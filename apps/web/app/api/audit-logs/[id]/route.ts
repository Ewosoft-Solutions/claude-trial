/** GET /api/audit-logs/[id] → NestJS GET /audit-logs/:id (drawer detail). */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/audit-logs/${encodeURIComponent(id)}`);
}
