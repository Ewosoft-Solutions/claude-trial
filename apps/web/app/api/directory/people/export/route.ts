/**
 * Route Handler: POST /api/directory/people/export
 * Proxies to NestJS POST /directory/people/export — the governed per-tab bulk
 * export (audited, masking-aware). Returns `{ filename, mimeType, content }`
 * JSON the client turns into a downloadable CSV blob.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = (req: NextRequest) =>
  proxyPost(req, '/directory/people/export', { status: 200 });
