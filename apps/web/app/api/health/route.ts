/**
 * Route Handler: /api/health
 *
 * GET /api/health?status=...  → NestJS GET /health/records
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/health/records');
