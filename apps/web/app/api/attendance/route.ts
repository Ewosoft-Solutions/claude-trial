/**
 * Route Handler: /api/attendance
 *
 * Proxies attendance reads + bulk saves to the NestJS backend,
 * attaching the access-token cookie as a Bearer header so the client
 * doesn't need to handle httpOnly cookies directly.
 *
 * GET  /api/attendance?classId=...&date=...   → NestJS GET /attendance
 * POST /api/attendance                        → NestJS POST /attendance/bulk
 */
import { NextRequest } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export const GET = (req: NextRequest) => proxyGet(req, '/attendance');
// Bulk save is idempotent-ish and returns the saved rows with a 200, not a 201.
export const POST = (req: NextRequest) =>
  proxyPost(req, '/attendance/bulk', { status: 200 });
