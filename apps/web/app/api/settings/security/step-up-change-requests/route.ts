import type { NextRequest } from 'next/server';

import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/security-policies/step-up-change-requests');
export const POST = (req: NextRequest) =>
  proxyPost(req, '/security-policies/step-up-change-requests');
