/**
 * Route Handler: /api/finance/payments
 *
 * GET  /api/finance/payments?invoiceId=...&from=...  → NestJS GET /finance/payments
 * POST /api/finance/payments                         → NestJS POST /finance/payments
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

function authHeader(req: NextRequest): Record<string, string> {
  const token = getBearerFromCookies(req.headers.get('cookie'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ payments: [], mock: true });
  }
  try {
    const qs = req.nextUrl.searchParams.toString();
    const data = await apiClient.get(`/finance/payments${qs ? `?${qs}` : ''}`, authHeader(req));
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json({ mock: true }, { status: 201 });
  }
  try {
    const body: unknown = await req.json();
    const data = await apiClient.post('/finance/payments', body, authHeader(req));
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
