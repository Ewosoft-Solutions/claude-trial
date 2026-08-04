/** POST /api/roles/preview → NestJS POST /roles/preview (WB1-5 draft eval). */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(req: NextRequest) {
  return proxyPost(req, '/roles/preview', { status: 200 });
}
