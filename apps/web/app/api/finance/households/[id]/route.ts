/**
 * Route Handler: /api/finance/households/[id]
 * GET → household + members/payers · PATCH → edit name / primary payer
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPatch } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGet(req, `/finance/households/${encodeURIComponent(id)}`);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPatch(req, `/finance/households/${encodeURIComponent(id)}`);
}
