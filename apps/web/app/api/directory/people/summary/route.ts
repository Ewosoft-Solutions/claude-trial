/**
 * Route Handler: GET /api/directory/people/summary
 * Proxies to NestJS GET /directory/people/summary — per-tab record counts for
 * the People workbench summary cards (only the tabs the caller may view).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/directory/people/summary');
