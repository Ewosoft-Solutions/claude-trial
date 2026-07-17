/**
 * Route-handler proxy helpers for the NestJS backend.
 *
 * Almost every handler under `app/api/*` does the same dance: pull the access
 * token from the httpOnly cookie, attach it as a Bearer header, forward the
 * request to the Nest API, and map the result (or an `ApiError`) to a
 * `NextResponse`. This module is the single source of truth for that pattern —
 * change the header shape, the error envelope, or the forwarding rules here and
 * every route inherits it.
 *
 * Two response strategies live side by side because they share the same auth
 * and error primitives but differ in how they emit the body:
 *   • proxyGet / proxyPost / proxyPatch / proxyPut / proxyDelete — buffer the
 *     upstream JSON body and re-emit it as JSON.
 *   • proxyStream — pipe the upstream ReadableStream through untouched (SSE),
 *     for endpoints that stream tokens rather than return a single payload.
 *
 * Server-only: it reads cookies and must never be imported from a client
 * component. Routes with bespoke behaviour (auth/cookies, file uploads, binary
 * passthrough, public no-auth invites) intentionally do NOT use these helpers.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

import { API_BASE, ApiError, apiClient } from '@/lib/api-client';
import { getBearerFromCookies } from '@/lib/server-api';
import {
  attachRefreshedAccess,
  refreshAccessForRequest,
  type RefreshedAccess,
} from '@/lib/server-refresh';

/** Bearer auth headers built from the request's access-token cookie. */
export function bearerAuthHeaders(
  req: NextRequest,
  accessToken?: string,
): Record<string, string> {
  const token = accessToken ?? getBearerFromCookies(req.headers.get('cookie'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function withAccessRefresh<T>(
  req: NextRequest,
  operation: (accessToken?: string) => Promise<T>,
): Promise<{ value: T; refreshed: RefreshedAccess | null }> {
  try {
    return { value: await operation(), refreshed: null };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const refreshed = await refreshAccessForRequest(req);
    if (!refreshed) throw error;
    return {
      value: await operation(refreshed.accessToken),
      refreshed,
    };
  }
}

/** Map a thrown error to the app's standard JSON error envelope. */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/**
 * Parse an optional JSON request body. Returns `undefined` for a body-less
 * request (e.g. a trigger POST like "reprocess") so those handlers don't have
 * to special-case an empty body.
 */
async function readOptionalJson(req: NextRequest): Promise<unknown> {
  const raw = await req.text();
  return raw ? JSON.parse(raw) : undefined;
}

/* ---- JSON proxies: buffer the upstream body, re-emit as JSON ------------- */

/** Forward a GET (incoming query string included) and return the JSON body. */
export async function proxyGet(
  req: NextRequest,
  upstreamPath: string,
): Promise<NextResponse> {
  try {
    const { value, refreshed } = await withAccessRefresh(req, (accessToken) =>
      apiClient.get(
        `${upstreamPath}${req.nextUrl.search}`,
        bearerAuthHeaders(req, accessToken),
      ),
    );
    return attachRefreshedAccess(
      NextResponse.json(value),
      refreshed,
    ) as NextResponse;
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Forward a DELETE (incoming query string included) and return the JSON body. */
export async function proxyDelete(
  req: NextRequest,
  upstreamPath: string,
): Promise<NextResponse> {
  try {
    const body = await readOptionalJson(req);
    const { value, refreshed } = await withAccessRefresh(req, (accessToken) =>
      apiClient.delete(
        `${upstreamPath}${req.nextUrl.search}`,
        body,
        bearerAuthHeaders(req, accessToken),
      ),
    );
    return attachRefreshedAccess(
      NextResponse.json(value),
      refreshed,
    ) as NextResponse;
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export interface ProxyWriteOptions {
  /** Success status for the JSON response. */
  status?: number;
}

async function proxyWrite(
  req: NextRequest,
  method: 'post' | 'patch' | 'put',
  upstreamPath: string,
  status: number,
): Promise<NextResponse> {
  try {
    const body = await readOptionalJson(req);
    const { value, refreshed } = await withAccessRefresh(req, (accessToken) =>
      apiClient[method](
        upstreamPath,
        body,
        bearerAuthHeaders(req, accessToken),
      ),
    );
    return attachRefreshedAccess(
      NextResponse.json(value, { status }),
      refreshed,
    ) as NextResponse;
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Forward a POST body. Defaults to 201 (resource created); override for actions. */
export function proxyPost(
  req: NextRequest,
  upstreamPath: string,
  { status = 201 }: ProxyWriteOptions = {},
): Promise<NextResponse> {
  return proxyWrite(req, 'post', upstreamPath, status);
}

/** Forward a PATCH body. Defaults to 200. */
export function proxyPatch(
  req: NextRequest,
  upstreamPath: string,
  { status = 200 }: ProxyWriteOptions = {},
): Promise<NextResponse> {
  return proxyWrite(req, 'patch', upstreamPath, status);
}

/** Forward a PUT body. Defaults to 200. */
export function proxyPut(
  req: NextRequest,
  upstreamPath: string,
  { status = 200 }: ProxyWriteOptions = {},
): Promise<NextResponse> {
  return proxyWrite(req, 'put', upstreamPath, status);
}

/* ---- Stream proxy: pipe the upstream SSE body through untouched ---------- */

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export interface ProxyStreamOptions {
  /** Generic fallback error when the upstream body can't be read. */
  errorMessage?: string;
  /**
   * Forward the upstream JSON body verbatim on failure instead of collapsing
   * it to `{ error }`. Needed when the client reads a structured pre-stream
   * response — e.g. the tutor's 403 assessment block `{ allowed, message,
   * alternatives }`.
   */
  forwardErrorBody?: boolean;
}

/**
 * Forward a POST to a streaming (SSE) endpoint, piping the upstream body
 * through untouched. Failures that happen BEFORE the stream opens (401/403/
 * 429…) surface as JSON, so the client can check `res.ok` before it starts
 * reading events.
 */
export async function proxyStream(
  req: NextRequest,
  upstreamPath: string,
  {
    errorMessage = 'AI request failed',
    forwardErrorBody = false,
  }: ProxyStreamOptions = {},
): Promise<Response> {
  if (!API_BASE) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  let token = getBearerFromCookies(req.headers.get('cookie'));
  let refreshed: RefreshedAccess | null = null;
  if (!token) {
    refreshed = await refreshAccessForRequest(req);
    if (!refreshed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    token = refreshed.accessToken;
  }

  const body = await req.text();
  const requestUpstream = (accessToken: string) =>
    fetch(`${API_BASE}${upstreamPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
      },
      body,
      // The LLM round-trip is long; never cache, never dedupe.
      cache: 'no-store',
    });

  let upstream = await requestUpstream(token);
  if (upstream.status === 401) {
    const retryAccess = await refreshAccessForRequest(req);
    if (retryAccess) {
      refreshed = retryAccess;
      upstream = await requestUpstream(retryAccess.accessToken);
    }
  }

  if (!upstream.ok || !upstream.body) {
    if (forwardErrorBody) {
      let body: unknown = { error: errorMessage };
      try {
        body = await upstream.json();
      } catch {
        // keep the generic error
      }
      return attachRefreshedAccess(
        NextResponse.json(body, { status: upstream.status }),
        refreshed,
      );
    }
    let message = errorMessage;
    try {
      const body = (await upstream.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      // keep the generic message
    }
    return attachRefreshedAccess(
      NextResponse.json({ error: message }, { status: upstream.status }),
      refreshed,
    );
  }

  return attachRefreshedAccess(
    new Response(upstream.body, { headers: SSE_HEADERS }),
    refreshed,
  );
}
