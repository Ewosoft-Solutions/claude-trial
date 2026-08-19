/** Route Handler: /api/finance/reports/collections → what was collected */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/reports/collections');
