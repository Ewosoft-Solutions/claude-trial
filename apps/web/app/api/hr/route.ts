/**
 * Route Handler: /api/hr
 *
 * GET  /api/hr?status=...&payPeriod=...  → NestJS GET /hr/payroll
 * POST /api/hr                          → NestJS POST /hr/payroll
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/hr/payroll');
export const POST = (req: NextRequest) => proxyPost(req, '/hr/payroll');
