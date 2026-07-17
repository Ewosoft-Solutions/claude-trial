import type { NextRequest } from 'next/server';

import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/auth/biometrics/policy');
