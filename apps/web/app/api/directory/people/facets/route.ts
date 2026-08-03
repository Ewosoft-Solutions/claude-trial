/**
 * Route Handler: GET /api/directory/people/facets
 * Proxies to NestJS GET /directory/people/facets — distinct grade-levels +
 * departments for the People workbench filter dropdowns.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyGet(req, '/directory/people/facets');
