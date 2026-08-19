/** Route Handler: /api/finance/ledger/entries → NestJS GET /finance/ledger/entries */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/ledger/entries');
