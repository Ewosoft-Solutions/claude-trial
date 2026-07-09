/**
 * Route Handler: /api/learning/materials/[id]
 *
 * DELETE → NestJS DELETE /learning/materials/:id (rows + stored binary)
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }
  const { id } = await params;
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const res = await fetch(
      `${API_BASE}/learning/materials/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (payload as { message?: string }).message ?? 'Delete failed';
      return NextResponse.json({ error: message }, { status: res.status });
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
