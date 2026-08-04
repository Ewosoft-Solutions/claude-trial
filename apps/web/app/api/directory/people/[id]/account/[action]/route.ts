/**
 * Route Handler: POST /api/directory/people/[id]/account/[action]
 * Proxies the WB1-3 account-provisioning actions to NestJS
 * POST /directory/people/:id/account/:action. The action is allow-listed so
 * this dynamic segment can never forward an arbitrary path.
 */
import { NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

const ACTIONS = new Set([
  'invite',
  'resend-invite',
  'suspend',
  'reactivate',
  'reset-password',
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ message: 'Unknown action' }, { status: 404 });
  }
  return proxyPost(
    req,
    `/directory/people/${encodeURIComponent(id)}/account/${action}`,
    { status: 200 },
  );
}
