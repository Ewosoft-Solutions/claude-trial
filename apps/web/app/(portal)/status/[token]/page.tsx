/**
 * Public status portal — `/status/[token]`. The token (an F5 SecureLink) is the
 * only capability; the client fetches + acts against the public API.
 */
import { API_BASE } from '@/lib/api-client';
import { StatusClient } from './status-client';
import type { StatusView } from '../../portal-types';

/**
 * Resolve the status here rather than letting the client do it on mount, so
 * the page has ONE wait: the route's skeleton is replaced by content, not by
 * the client's spinner. Mirrors the apply page's public fetch.
 */
async function getStatus(token: string): Promise<StatusView | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(
      `${API_BASE}/public/admissions/status/${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as StatusView;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default async function StatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const initialStatus = await getStatus(token);
  return <StatusClient token={token} initialStatus={initialStatus} />;
}
