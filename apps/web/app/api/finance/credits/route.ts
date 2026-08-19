/** Route Handler: /api/finance/credits → NestJS GET /finance/credits */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/finance/credits');
