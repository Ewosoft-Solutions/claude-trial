/**
 * Route Handler: POST /api/directory/students/export
 * Proxies to NestJS POST /directory/students/export — the governed bulk export
 * (audited, masking-aware). Returns `{ filename, mimeType, content }` JSON that
 * the client turns into a downloadable CSV blob.
 */
import { NextRequest } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export const POST = (req: NextRequest) =>
  proxyPost(req, '/directory/students/export', { status: 200 });
