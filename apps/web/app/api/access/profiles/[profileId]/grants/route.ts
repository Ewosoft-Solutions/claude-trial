/**
 * Route Handler: GET /api/access/profiles/[profileId]/grants — proxy to NestJS
 * GET /access/profiles/:profileId/grants (WB1-6): a profile's active grant +
 * pending high-risk grant requests.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;
  return proxyGet(
    req,
    `/access/profiles/${encodeURIComponent(profileId)}/grants`,
  );
}
