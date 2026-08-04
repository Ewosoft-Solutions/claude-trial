/**
 * Route Handler: DELETE .../employment/[employmentId]/qualifications/[qualificationId]
 * Proxies to NestJS DELETE .../qualifications/:qualificationId (WB1-2) — remove
 * a qualification.
 */
import { NextRequest } from 'next/server';
import { proxyDelete } from '@/lib/api-proxy';

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      employmentId: string;
      qualificationId: string;
    }>;
  },
) {
  const { id, employmentId, qualificationId } = await params;
  return proxyDelete(
    req,
    `/directory/people/${encodeURIComponent(id)}/employment/${encodeURIComponent(employmentId)}/qualifications/${encodeURIComponent(qualificationId)}`,
  );
}
