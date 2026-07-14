/**
 * Route Handler: /api/tenant/features
 *
 * GET   -> NestJS GET   /tenant/features  (current tenant feature toggles)
 * PATCH -> NestJS PATCH /tenant/features  (toggle modules)
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPatch } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/tenant/features');
export const PATCH = (req: NextRequest) => proxyPatch(req, '/tenant/features');
