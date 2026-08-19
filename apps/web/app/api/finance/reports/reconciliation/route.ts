/** Route Handler: /api/finance/reports/reconciliation → subledger vs ledger */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/reports/reconciliation');
