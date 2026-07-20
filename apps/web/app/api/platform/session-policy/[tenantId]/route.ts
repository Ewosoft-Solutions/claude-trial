import type { NextRequest } from 'next/server';

import { proxyGet, proxyPatch } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  return proxyGet(
    req,
    `/platform/security-policies/${encodeURIComponent(tenantId)}/session`,
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  return proxyPatch(
    req,
    `/platform/security-policies/${encodeURIComponent(tenantId)}/session`,
  );
}
