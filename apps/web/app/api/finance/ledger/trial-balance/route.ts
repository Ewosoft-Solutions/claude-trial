/** Route Handler: /api/finance/ledger/trial-balance → NestJS GET trial balance */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/ledger/trial-balance');
