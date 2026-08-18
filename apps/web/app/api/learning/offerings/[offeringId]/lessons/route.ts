/**
 * Route Handler: /api/learning/offerings/[offeringId]/lessons
 *
 * GET → what this class is taught (its scheduled library lessons).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ offeringId: string }> },
) {
  const { offeringId } = await ctx.params;
  return proxyGet(
    req,
    `/learning/offerings/${encodeURIComponent(offeringId)}/lessons`,
  );
}
