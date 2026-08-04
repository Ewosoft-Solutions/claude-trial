/**
 * Route Handler: POST .../employment/[employmentId]/qualifications
 * Proxies to NestJS POST .../employment/:employmentId/qualifications (WB1-2) —
 * add a qualification to an employment record.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; employmentId: string }> },
) {
  const { id, employmentId } = await params;
  return proxyPost(
    req,
    `/directory/people/${encodeURIComponent(id)}/employment/${encodeURIComponent(employmentId)}/qualifications`,
    { status: 201 },
  );
}
