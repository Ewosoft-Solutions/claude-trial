/**
 * Route Handler: /api/learning/lesson-instances/[id]
 *
 * PATCH  → reschedule / annotate / mark taught or skipped
 * DELETE → unschedule for this class (the library lesson is untouched)
 */
import { NextRequest } from 'next/server';
import { proxyDelete, proxyPatch } from '@/lib/api-proxy';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return proxyPatch(req, `/learning/lesson-instances/${encodeURIComponent(id)}`);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return proxyDelete(
    req,
    `/learning/lesson-instances/${encodeURIComponent(id)}`,
  );
}
