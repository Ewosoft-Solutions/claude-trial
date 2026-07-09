/**
 * Route Handler: /api/ai/analytics/sessions
 *
 * GET → NestJS GET /ai/analytics/sessions (the caller's own analytics
 * chat sessions, newest first).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function GET(req: NextRequest) {
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const data = await apiClient.get(
      '/ai/analytics/sessions',
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
