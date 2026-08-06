/** Route Handler: DELETE /api/finance/households/payers/[payerId] — end a payer. */
import { NextRequest } from 'next/server';
import { proxyDelete } from '@/lib/api-proxy';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ payerId: string }> },
) {
  const { payerId } = await params;
  return proxyDelete(
    req,
    `/finance/households/payers/${encodeURIComponent(payerId)}`,
  );
}
