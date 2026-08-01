/**
 * Route Handler: GET /api/directory/students
 * Proxies to NestJS GET /directory/students (the governed students projection),
 * forwarding query params (page/filter/sort) and the Bearer token.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/directory/students');
