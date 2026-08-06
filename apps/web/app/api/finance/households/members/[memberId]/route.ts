/** Route Handler: DELETE /api/finance/households/members/[memberId] — end a membership. */
import { NextRequest } from 'next/server';
import { proxyDelete } from '@/lib/api-proxy';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;
  return proxyDelete(
    req,
    `/finance/households/members/${encodeURIComponent(memberId)}`,
  );
}
