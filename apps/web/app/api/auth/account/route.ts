import type { NextRequest } from 'next/server';

import { proxyPatch } from '@/lib/api-proxy';

export const PATCH = (request: NextRequest) =>
  proxyPatch(request, '/auth/account');
