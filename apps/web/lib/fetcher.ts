/**
 * Default SWR fetcher for the app's internal `/api/*` routes.
 *
 * Returns parsed JSON and, on a non-2xx response, throws an Error carrying the
 * route's `{ error }` message (the shape every proxy handler emits — see
 * lib/api-proxy.ts) so SWR surfaces it through its `error` field.
 */
import { authedFetch } from '@/lib/authed-fetch';

export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await authedFetch(url);
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as T;
}
