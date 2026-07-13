/**
 * Route Handler: /api/roles
 *
 * GET -> NestJS GET /roles  (assignable roles: system + tenant custom)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

export async function GET(req: NextRequest) {
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const data = await apiClient.get<
      Array<{
        id: string;
        name: string;
        clearanceLevel?: number;
        roleType?: string;
      }>
    >('/roles', headers);
    // Trim the heavy pool includes to just what a role picker needs.
    const roles = (Array.isArray(data) ? data : []).map((r) => ({
      id: r.id,
      name: r.name,
      clearanceLevel: r.clearanceLevel ?? null,
      roleType: r.roleType ?? null,
    }));
    return NextResponse.json(roles);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
