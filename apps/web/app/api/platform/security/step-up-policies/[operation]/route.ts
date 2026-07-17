import type { NextRequest } from 'next/server';

import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ operation: string }> },
) {
  const { operation } = await params;
  return proxyPatch(
    req,
    `/platform/security-policies/step-up-policies/${encodeURIComponent(operation)}`,
  );
}
