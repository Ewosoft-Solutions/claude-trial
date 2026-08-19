/** Route Handler: /api/finance/credits/[id]/apply → NestJS POST (draw credit down) */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => proxyPost(req, `/finance/credits/${(await params).id}/apply`);
