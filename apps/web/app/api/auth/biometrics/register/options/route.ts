/**
 * POST /api/auth/biometrics/register/options
 *
 * Proxy for NestJS POST /auth/biometrics/register/options — returns WebAuthn
 * registration options for enrolling a platform authenticator. 200 (not 201):
 * it produces a challenge, not a resource.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export function POST(req: NextRequest) {
  return proxyPost(req, '/auth/biometrics/register/options', { status: 200 });
}
