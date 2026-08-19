/** Route Handler: /api/finance/households/[id]/outstanding → what a family owes */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => proxyGet(req, `/finance/households/${(await params).id}/outstanding`);
