/** Route Handler: /api/finance/receipts/[id] → NestJS GET /finance/receipts/:id */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => proxyGet(req, `/finance/receipts/${(await params).id}`);
