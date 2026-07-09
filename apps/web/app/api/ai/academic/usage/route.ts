/**
 * Route Handler: /api/ai/academic/usage
 *
 * GET → NestJS GET /ai/academic/usage (teacher visibility v1: per-class tutor
 * usage for classes the caller teaches; optional ?classId=).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function GET(req: NextRequest) {
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const data = await apiClient.get(
      `/ai/academic/usage${req.nextUrl.search}`,
      token ? { Authorization: `Bearer ${token}` } : {},
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
