/**
 * Route Handler: POST /api/access/profiles/[profileId]/revoke — proxy to NestJS
 * POST /access/profiles/:profileId/revoke (WB1-6): revoke a profile's role grant.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;
  return proxyPost(
    req,
    `/access/profiles/${encodeURIComponent(profileId)}/revoke`,
    { status: 200 },
  );
}
