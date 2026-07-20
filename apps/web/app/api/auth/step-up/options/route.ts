/** Begin an operation-bound step-up ceremony for the signed-in user. */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export function POST(req: NextRequest) {
  return proxyPost(req, '/auth/step-up/options', { status: 200 });
}
