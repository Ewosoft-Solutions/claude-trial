/** Route Handler: /api/finance/reports/aging → outstanding debt by age */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/reports/aging');
