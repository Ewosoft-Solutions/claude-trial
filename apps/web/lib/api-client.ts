/**
 * Thin fetch wrapper for the apps/api NestJS backend.
 *
 * Base URL is resolved from NEXT_PUBLIC_API_URL (required in production) with
 * a localhost fallback for local development.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
};
