/**
 * `serverApiGet` error-handling contract.
 *
 * The helper used to map EVERY non-2xx response to `null`, which silently
 * turned a malformed request (e.g. `/students?limit=1000`, capped at 100) into
 * an empty list — the bug that broke the finance, analytics and attendance
 * pages with no error anywhere. These tests pin the current contract:
 *   - 2xx            → parsed body
 *   - 401/403/404    → null (legitimate "nothing to show you")
 *   - 400/422        → throw ServerApiRequestError (a bug in our request)
 *   - other non-2xx  → null, but logged (don't crash on transient upstream)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api-client', () => ({ API_BASE: 'http://api.test' }));

const getCookie = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: getCookie })),
}));

import { serverApiGet, ServerApiRequestError } from './server-api';

type FetchResult = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function respondWith(status: number, body: unknown): void {
  const result: FetchResult = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => result),
  );
}

describe('serverApiGet', () => {
  beforeEach(() => {
    getCookie.mockReturnValue({ value: 'token-abc' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    getCookie.mockReset();
  });

  it('returns the parsed body on 2xx', async () => {
    respondWith(200, { data: [{ id: 's1' }] });
    await expect(serverApiGet('/students/roster')).resolves.toEqual({
      data: [{ id: 's1' }],
    });
  });

  it('returns null (no request) when unauthenticated', async () => {
    getCookie.mockReturnValue(undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(serverApiGet('/students/roster')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])(
    'returns null on %i (expected empty state)',
    async (status) => {
      respondWith(status, { message: 'nope' });
      await expect(serverApiGet('/finance/invoices')).resolves.toBeNull();
    },
  );

  it.each([400, 422])(
    'throws ServerApiRequestError on %i (a malformed request is a bug)',
    async (status) => {
      respondWith(status, { message: ['limit must not be greater than 100'] });
      const err: unknown = await serverApiGet('/students?limit=1000').catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(ServerApiRequestError);
      const requestError = err as ServerApiRequestError;
      expect(requestError.status).toBe(status);
      expect(requestError.path).toBe('/students?limit=1000');
    },
  );

  it('logs and returns null on 5xx (transient upstream, do not crash)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    respondWith(503, { message: 'unavailable' });
    await expect(serverApiGet('/students/roster')).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
