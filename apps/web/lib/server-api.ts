/**
 * Server-side authenticated fetch helper for the NestJS backend.
 *
 * This module is server-only: it reads httpOnly cookies and must only run in
 * server components, server actions, or Route Handlers. Never import it from
 * a 'use client' module.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE_ACCESS_TOKEN } from './auth-cookies';
import { API_BASE } from './api-client';

/**
 * Thrown when a `serverApiGet` request is rejected as malformed (HTTP 400/422).
 *
 * A 4xx client-error means WE built an invalid request — a bad filter, an
 * over-cap `limit`, an unknown query key. That is always a bug in the calling
 * page, never a legitimate "no data" outcome, so it is surfaced instead of
 * being masqueraded as an empty result. Silently swallowing it is exactly what
 * hid the `/students?limit=1000` breakage across the finance, analytics and
 * attendance pages (every one of those endpoints caps `limit` at 100).
 */
export class ServerApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'ServerApiRequestError';
  }
}

/** Best-effort read of an error body for diagnostics; never throws. */
async function readErrorSnippet(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  } catch {
    return '';
  }
}

/**
 * Authenticated GET against the API.
 *
 * Returns `null` for the expected "nothing to show you" outcomes so callers can
 * render an empty state: no API base, no access token, or a 401/403/404 from
 * upstream (unauthenticated / forbidden / not found).
 *
 * A 400/422 (a request WE built wrong) throws {@link ServerApiRequestError} so
 * the bug fails loudly in dev/CI/e2e rather than degrading into a silent empty
 * list. Other non-2xx statuses (5xx, 429, …) are logged and degrade to `null`,
 * since crashing a page on a transient upstream hiccup helps no one.
 */
export async function serverApiGet<T>(path: string): Promise<T | null> {
  if (!API_BASE) return null;

  const jar = await cookies();
  const token = jar.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) return null;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (res.ok) {
    // A nullable endpoint (e.g. "no published form yet") returns HTTP 200 with an
    // EMPTY body — `res.json()` would throw "Unexpected end of JSON input" on it.
    // Treat an empty body as `null` so callers render an empty state, not a crash.
    const text = await res.text();
    return (text ? (JSON.parse(text) as T) : null) as T | null;
  }

  // Expected empty-state outcomes: the caller lacks access or the record is
  // gone. These are legitimately "render nothing", not bugs.
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return null;
  }

  const snippet = await readErrorSnippet(res);
  const detail = `serverApiGet ${path} -> HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`;

  // A malformed request is a bug in the calling page — surface it loudly.
  if (res.status === 400 || res.status === 422) {
    throw new ServerApiRequestError(detail, res.status, path);
  }

  // 5xx / 429 / anything else: observable in logs, but don't take the page down.
  console.error(`[serverApiGet] ${detail}`);
  return null;
}

/** For use in Route Handlers: forward request with the access-token cookie. */
export function getBearerFromCookies(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_ACCESS_TOKEN}=([^;]+)`),
  );
  return match?.[1] ?? null;
}
