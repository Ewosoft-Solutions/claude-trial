/**
 * POST /api/auth/biometrics/register/verify
 *
 * Proxy for NestJS POST /auth/biometrics/register/verify — verifies the
 * attestation and stores the enrolled device (201 created).
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export function POST(req: NextRequest) {
  return proxyPost(req, '/auth/biometrics/register/verify', { status: 201 });
}
