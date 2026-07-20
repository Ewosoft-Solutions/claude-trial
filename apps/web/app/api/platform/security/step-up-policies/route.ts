import type { NextRequest } from 'next/server';

import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/platform/security-policies/step-up-policies');
