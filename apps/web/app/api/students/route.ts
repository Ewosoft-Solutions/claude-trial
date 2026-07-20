/**
 * Route Handler: GET /api/students
 * Proxies to NestJS GET /students, forwarding query params and the Bearer token.
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/students');
