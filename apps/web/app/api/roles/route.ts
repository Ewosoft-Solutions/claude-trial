/**
 * Route Handler: /api/roles
 *
 * GET -> NestJS GET /roles  (assignable roles: system + tenant custom)
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';
import {
  apiErrorResponse,
  bearerAuthHeaders,
  proxyPost,
} from '@/lib/api-proxy';

/** POST /api/roles → NestJS POST /roles (create a custom role, WB1-5). */
export async function POST(req: NextRequest) {
  return proxyPost(req, '/roles', { status: 201 });
}

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
