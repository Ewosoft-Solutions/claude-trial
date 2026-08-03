/**
 * Route Handler: GET /api/directory/people
 * Proxies to NestJS GET /directory/people (the governed People projection),
 * forwarding query params (type/page/filter/sort) and the Bearer token.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/directory/people');
