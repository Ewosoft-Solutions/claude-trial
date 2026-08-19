/** Route Handler: /api/finance/ledger/entries/[id]/reverse → post a contra entry */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => proxyPost(req, `/finance/ledger/entries/${(await params).id}/reverse`);
