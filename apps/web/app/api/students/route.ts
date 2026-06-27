/**
 * Route Handler: GET /api/students
 * Proxies to NestJS GET /students, forwarding query params and the Bearer token.
 * Returns an empty list when no API URL is configured (dev fallback).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function GET(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ students: [] });
  }
  try {
    const token = getBearerFromCookies(req.headers.get('cookie'));
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const qs = req.nextUrl.searchParams.toString();
    const data = await apiClient.get(`/students${qs ? `?${qs}` : ''}`, headers);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
