/** Route Handler: POST /api/finance/households/[id]/payers — add a payer. */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPost(req, `/finance/households/${encodeURIComponent(id)}/payers`);
}
