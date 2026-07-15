import type { NextRequest } from 'next/server';

import { proxyGet, proxyPut } from '@/lib/api-proxy';

export const GET = (request: NextRequest) =>
  proxyGet(request, '/tenant/configuration');

export const PUT = (request: NextRequest) =>
  proxyPut(request, '/tenant/configuration');
