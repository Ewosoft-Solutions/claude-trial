import type { NextRequest } from 'next/server';

import { proxyGet, proxyPatch } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/security-policies/biometrics');
export const PATCH = (req: NextRequest) =>
  proxyPatch(req, '/security-policies/biometrics');
