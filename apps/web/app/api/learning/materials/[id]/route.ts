/**
 * Route Handler: /api/learning/materials/[id]
 *
 * DELETE → NestJS DELETE /learning/materials/:id (rows + stored binary)
 */
import { NextRequest } from 'next/server';
import { proxyDelete } from '@/lib/api-proxy';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyDelete(req, `/learning/materials/${encodeURIComponent(id)}`);
}
