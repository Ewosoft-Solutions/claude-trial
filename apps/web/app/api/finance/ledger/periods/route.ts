/** Route Handler: /api/finance/ledger/periods → list / define accounting periods */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/ledger/periods');
export const POST = (req: NextRequest) =>
  proxyPost(req, '/finance/ledger/periods');
