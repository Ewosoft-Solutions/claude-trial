/** GET /api/audit-logs → NestJS GET /audit-logs (filters + search + paging). */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  return proxyGet(req, '/audit-logs');
}
