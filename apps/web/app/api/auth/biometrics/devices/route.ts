/**
 * GET /api/auth/biometrics/devices
 *
 * Proxy for NestJS GET /auth/biometrics/devices — lists the user's enrolled
 * platform authenticators.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export function GET(req: NextRequest) {
  return proxyGet(req, '/auth/biometrics/devices');
}
