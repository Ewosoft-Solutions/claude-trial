import type { NextRequest } from 'next/server';

import { proxyGet } from '@/lib/api-proxy';

export const GET = (request: NextRequest) => proxyGet(request, '/search');
