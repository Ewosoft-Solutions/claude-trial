/**
 * WB4 · client fetch helpers for the results workbench. Every call goes through
 * the /api/academics/results/* proxy (permissions + maker-checker enforced
 * server-side); these just standardise error extraction + JSON handling.
 */
export async function extractError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
      error?: string;
    };
    const m = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    return m || data.error || fallback;
  } catch {
    return fallback;
  }
}

const BASE = '/api/academics/results';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await extractError(res, 'Request failed'));
  return (await res.json()) as T;
}

async function write<T>(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Action failed'));
  return (await res.json()) as T;
}

export const apiPost = <T>(path: string, body?: unknown) =>
  write<T>('POST', path, body);
export const apiPatch = <T>(path: string, body?: unknown) =>
  write<T>('PATCH', path, body);
export const apiPut = <T>(path: string, body?: unknown) =>
  write<T>('PUT', path, body);
