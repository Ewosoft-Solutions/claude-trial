/**
 * Route Handler: /api/finance/invoices
 *
 * GET  /api/finance/invoices?status=...&termName=...  → NestJS GET /finance/invoices
 * POST /api/finance/invoices                          → NestJS POST /finance/invoices
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/finance/invoices');
export const POST = (req: NextRequest) => proxyPost(req, '/finance/invoices');
