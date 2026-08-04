/**
 * Route Handler: /api/directory/people/[id]/employment
 * Proxies to NestJS GET/POST /directory/people/:id/employment (WB1-2) — a
 * person's first-class employment record(s), and opening a new one.
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(
    req,
    `/directory/people/${encodeURIComponent(id)}/employment`,
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPost(
    req,
    `/directory/people/${encodeURIComponent(id)}/employment`,
    { status: 201 },
  );
}
