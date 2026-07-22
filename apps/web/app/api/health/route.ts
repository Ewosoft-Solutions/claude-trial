/**
 * Route Handler: GET /api/health — web → API connectivity check.
 *
 * Answers one question: **can the Next server reach the API?** That is the
 * wiring most likely to be broken after a deploy (`NEXT_PUBLIC_API_URL` unset,
 * scheme-less, or stale because it is inlined at build time), and nothing
 * exposed it directly before: CD inferred it by probing a JWT-guarded business
 * route and asserting a 401, which was indirect and easy to misread.
 *
 * This path previously proxied `/health/records` (student *medical* records —
 * the `health` domain, not a health check). Nothing in the app used it; the
 * records page calls the API server-side via `serverApiGet`. The name is now
 * what it says it is.
 *
 * Deliberately:
 *  - **Unauthenticated** — a connectivity probe for CI, uptime monitoring and a
 *    human with `curl`. It reveals only whether the API is reachable, never any
 *    tenant data.
 *  - Resolved through the same `API_BASE` the real proxy uses, so a pass here
 *    means the app's actual path works, not a parallel one that might differ.
 *  - Never cached and time-boxed, so a hung API surfaces as a failure rather
 *    than a hanging probe.
 *  - Non-2xx (503) when the round-trip fails, so CI and monitors can gate on
 *    the status code alone.
 */
import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-client';

/** A health probe must never be served from cache. */
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 5_000;

interface HealthBody {
  status: 'ok' | 'degraded';
  web: 'up';
  api: 'up' | 'unreachable' | 'unhealthy' | 'not-configured';
  /** Present only when the API answered with a non-2xx. */
  apiStatus?: number;
  /** Operator hint; never includes credentials or tenant data. */
  detail?: string;
}

function json(body: HealthBody, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  if (!API_BASE) {
    // Empty in production means NEXT_PUBLIC_API_URL was not set at BUILD time.
    return json(
      {
        status: 'degraded',
        web: 'up',
        api: 'not-configured',
        detail:
          'NEXT_PUBLIC_API_URL is not set. It is inlined at build time — set it and rebuild.',
      },
      503,
    );
  }

  try {
    const res = await fetch(`${API_BASE}/healthz`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return json(
        {
          status: 'degraded',
          web: 'up',
          api: 'unhealthy',
          apiStatus: res.status,
        },
        503,
      );
    }

    return json({ status: 'ok', web: 'up', api: 'up' }, 200);
  } catch {
    // Swallow the cause: DNS/TLS/timeout detail could disclose internal
    // topology on a public, unauthenticated endpoint.
    return json(
      {
        status: 'degraded',
        web: 'up',
        api: 'unreachable',
        detail: 'The web server could not reach the API.',
      },
      503,
    );
  }
}
