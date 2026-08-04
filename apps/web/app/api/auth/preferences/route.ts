/**
 * Route Handler: PATCH /api/auth/preferences
 * Proxies to NestJS PATCH /auth/preferences — persists per-account UI
 * preferences (today: the preferred table page size).
 */
import { NextRequest } from 'next/server';
import { proxyPatch } from '@/lib/api-proxy';

export const PATCH = (req: NextRequest) => proxyPatch(req, '/auth/preferences');
