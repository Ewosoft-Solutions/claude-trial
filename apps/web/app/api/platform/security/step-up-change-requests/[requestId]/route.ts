import type { NextRequest } from 'next/server';

import { proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  return proxyPatch(
    req,
    `/platform/security-policies/step-up-change-requests/${encodeURIComponent(requestId)}`,
  );
}
