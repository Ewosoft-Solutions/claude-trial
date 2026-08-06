/**
 * Route Handler: /api/finance/discount-policies
 *
 * GET  → NestJS GET  /finance/discount-policies  (list tenant policies)
 * POST → NestJS POST /finance/discount-policies  (create; activation needs approval)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/finance/discount-policies');
export const POST = (req: NextRequest) =>
  proxyPost(req, '/finance/discount-policies');
