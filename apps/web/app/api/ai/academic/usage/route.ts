/**
 * Route Handler: /api/ai/academic/usage
 *
 * GET → NestJS GET /ai/academic/usage (teacher visibility v1: per-class tutor
 * usage for classes the caller teaches; optional ?classId=).
 */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/ai/academic/usage');
