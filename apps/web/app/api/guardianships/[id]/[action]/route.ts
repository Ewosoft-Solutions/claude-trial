/**
 * Route Handler: POST /api/guardianships/[id]/[action]
 * Proxies the WB1-4 guardianship sub-actions to NestJS
 * POST /guardianships/:id/:action. The action is allow-listed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

const ACTIONS = new Set(['verify', 'end']);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ message: 'Unknown action' }, { status: 404 });
  }
  return proxyPost(req, `/guardianships/${encodeURIComponent(id)}/${action}`, {
    status: 200,
  });
}
