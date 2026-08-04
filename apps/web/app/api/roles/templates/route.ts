/** GET /api/roles/templates → NestJS GET /roles/templates (WB1-5 presets). */
import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  return proxyGet(req, '/roles/templates');
}
