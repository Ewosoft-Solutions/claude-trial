/**
 * Route Handler: /api/platform/schools
 *
 * GET  -> NestJS GET  /tenant           (list all schools; platform-scoped)
 * POST -> NestJS POST /tenant/register  (register a new school)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/tenant');
export const POST = (req: NextRequest) => proxyPost(req, '/tenant/register');
