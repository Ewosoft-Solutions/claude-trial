/**
 * Route Handler: /api/roles
 *
 * GET -> NestJS GET /roles  (assignable roles: system + tenant custom)
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';
import { apiErrorResponse, bearerAuthHeaders } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  try {
    const data = await apiClient.get<
      Array<{
        id: string;
        name: string;
        clearanceLevel?: number;
        roleType?: string;
      }>
    >('/roles', bearerAuthHeaders(req));
    // Trim the heavy pool includes to just what a role picker needs.
    const roles = (Array.isArray(data) ? data : []).map((r) => ({
      id: r.id,
      name: r.name,
      clearanceLevel: r.clearanceLevel ?? null,
      roleType: r.roleType ?? null,
    }));
    return NextResponse.json(roles);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
