/**
 * Route Handler: POST /api/finance/households/derive
 * Auto-derive households from guardian clusters (idempotent).
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = (req: NextRequest) =>
  proxyPost(req, '/finance/households/derive', { status: 200 });
