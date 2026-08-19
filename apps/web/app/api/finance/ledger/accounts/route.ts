/** Route Handler: /api/finance/ledger/accounts → the chart of accounts */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/ledger/accounts');
