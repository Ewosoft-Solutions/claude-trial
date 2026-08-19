/**
 * Route Handler: /api/finance/ledger/export
 *
 * Streams the journal CSV straight through, so the browser gets the upstream's
 * content-type + filename rather than a JSON envelope.
 */
import { NextRequest } from 'next/server';
import { proxyDownload } from '@/lib/api-proxy';

export const GET = (req: NextRequest) =>
  proxyDownload(req, '/finance/ledger/export');
