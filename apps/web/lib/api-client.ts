/**
 * Thin fetch wrapper for the apps/api NestJS backend.
 *
 * Base URL is resolved from NEXT_PUBLIC_API_URL. Local development falls back
 * to the Nest API default port so dev seeds can be exercised through real
 * backend requests.
 *
 * Error hygiene mirrors the API's `HttpExceptionFilter`: the client gets a
 * toast-ready `message`, the real cause is always logged server-side, and the
 * internal detail ships in the response body ONLY under `API_DEBUG_ERRORS=true`.
 * Unset principle — absent the flag, nothing debug is emitted regardless of
 * NODE_ENV.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');

/** Opt-in debug payloads. Read per call so tests can toggle it. */
function debugErrors(): boolean {
  return process.env.API_DEBUG_ERRORS === 'true';
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /**
     * Operator-facing detail (host names, transport failures, config hints).
     * Always logged; only returned to the client under API_DEBUG_ERRORS.
     */
    public readonly internalMessage?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Standard JSON error envelope. Every route handler should build its error
 * body through this so the debug flag is honoured in exactly one place.
 */
export function apiErrorBody(
  message: string,
  internalMessage?: string,
): { error: string; internalMessage?: string } {
  return internalMessage && debugErrors()
    ? { error: message, internalMessage }
    : { error: message };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';

  if (!API_BASE) {
    throw new ApiError(
      503,
      'API not configured',
      'NEXT_PUBLIC_API_URL resolved to an empty string. It is inlined at BUILD ' +
        'time, so it must be present when `next build` runs — setting it in the ' +
        'hosting dashboard afterwards does nothing until you redeploy.',
    );
  }

  const url = `${API_BASE}${path}`;
  let res: Response;

  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (cause) {
    // fetch() rejects only when the request never reached the API at all — a
    // malformed base URL, DNS/TLS failure, or a refused connection. It does NOT
    // reject for a non-2xx response. Left unclassified this surfaces as an
    // opaque 500 that looks identical to a bug in the calling route, so name it
    // for what it is: a gateway failure, with the base URL that produced it.
    const detail = cause instanceof Error ? cause.message : String(cause);
    const internalMessage =
      `${method} ${url} failed before any response: ${detail}. ` +
      `NEXT_PUBLIC_API_URL=${JSON.stringify(process.env.NEXT_PUBLIC_API_URL ?? null)} ` +
      `(resolved base ${JSON.stringify(API_BASE)}) — it must be a full origin ` +
      'including the scheme, e.g. https://api.example.com, and is inlined at build time.';

    console.error('[api-client] upstream unreachable:', internalMessage, cause);
    throw new ApiError(502, 'Upstream API unreachable', internalMessage);
  }

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const json = JSON.parse(body);
      message = json.message ?? body;
    } catch {
      // keep raw body
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  post<T>(path: string, body: unknown, headers?: Record<string, string>) {
    return request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  },

  get<T>(path: string, headers?: Record<string, string>) {
    return request<T>(path, { method: 'GET', headers });
  },

  patch<T>(path: string, body: unknown, headers?: Record<string, string>) {
    return request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers,
    });
  },

  put<T>(path: string, body: unknown, headers?: Record<string, string>) {
    return request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers,
    });
  },

  delete<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return request<T>(path, {
      method: 'DELETE',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers,
    });
  },
};
