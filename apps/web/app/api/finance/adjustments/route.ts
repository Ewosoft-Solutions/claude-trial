/**
 * Route Handler: POST /api/finance/adjustments
 * Proxies to NestJS POST /finance/adjustments — request a discretionary
 * adjustment (stays pending until a second authority approves it).
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = (req: NextRequest) =>
  proxyPost(req, '/finance/adjustments');
