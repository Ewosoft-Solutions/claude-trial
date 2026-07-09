/**
 * Thin fetch wrapper for the apps/api NestJS backend.
 *
 * Base URL is resolved from NEXT_PUBLIC_API_URL. Local development falls back
 * to the Nest API default port so dev seeds can be exercised through real
 * backend requests.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!API_BASE) {
    throw new ApiError(503, 'API not configured');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

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
};
