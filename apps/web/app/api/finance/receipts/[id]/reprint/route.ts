/** Route Handler: /api/finance/receipts/[id]/reprint → NestJS POST (audited reprint) */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => proxyPost(req, `/finance/receipts/${(await params).id}/reprint`);
