/** Route Handler: /api/finance/ledger/periods/[id] → close or reopen a period */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => proxyPatch(req, `/finance/ledger/periods/${(await params).id}`);
