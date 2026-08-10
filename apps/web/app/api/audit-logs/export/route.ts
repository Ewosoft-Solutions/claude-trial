/**
 * GET /api/audit-logs/export → NestJS GET /audit-logs/export.
 * Streams the CSV / XLSX / PDF file through, preserving its download headers.
 */
import { NextRequest } from 'next/server';
import { proxyDownload } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  return proxyDownload(req, '/audit-logs/export');
}
