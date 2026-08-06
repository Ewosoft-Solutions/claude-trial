/**
 * Route Handler: /api/finance/households
 * GET → list billing households · POST → create a household
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/finance/households');
export const POST = (req: NextRequest) => proxyPost(req, '/finance/households');
