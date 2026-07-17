/** Verify a passkey assertion or current-password step-up. */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export function POST(req: NextRequest) {
  return proxyPost(req, '/auth/step-up/verify', { status: 200 });
}
