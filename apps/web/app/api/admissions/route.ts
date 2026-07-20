/**
 * Route Handler: /api/admissions
 *
 * GET  /api/admissions?stage=...&decision=...  → NestJS GET /admissions/applications
 * POST /api/admissions                         → NestJS POST /admissions/applications
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/admissions/applications');
export const POST = (req: NextRequest) => proxyPost(req, '/admissions/applications');
