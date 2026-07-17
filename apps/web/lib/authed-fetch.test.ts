import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('authenticated browser fetch', () => {
  let storage: MemoryStorage;
  let dispatchEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    storage = new MemoryStorage();
    dispatchEvent = vi.fn();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal(
      'CustomEvent',
      class {
        constructor(
          public readonly type: string,
          public readonly init?: { detail?: unknown },
        ) {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deduplicates concurrent refreshes within one tab', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { refreshBrowserSession } = await import('./authed-fetch');

    const first = refreshBrowserSession();
    const second = refreshBrowserSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(
      new Response(JSON.stringify({ accessExpiresAt: 123_456 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(first).resolves.toEqual({
      success: true,
      accessExpiresAt: 123_456,
    });
    await expect(second).resolves.toEqual({
      success: true,
      accessExpiresAt: 123_456,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a refresh completed by another tab while waiting for Web Locks', async () => {
    const fetchMock = vi.fn();
    const request = vi.fn(
      async (_name: string, callback: () => Promise<unknown>) => {
        storage.setItem(
          'swe:session-refresh:v1',
          JSON.stringify({
            version: 1,
            refreshedAt: Date.now(),
            accessExpiresAt: 987_654,
          }),
        );
        return callback();
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { onLine: true, locks: { request } });
    const { refreshBrowserSession } = await import('./authed-fetch');

    await expect(refreshBrowserSession()).resolves.toEqual({
      success: true,
      accessExpiresAt: 987_654,
    });
    expect(request).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes once and retries the original request after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessExpiresAt: 222_222 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    const { authedFetch } = await import('./authed-fetch');

    const response = await authedFetch('/api/private', {
      method: 'POST',
      body: JSON.stringify({ value: 1 }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/private',
      '/api/auth/refresh',
      '/api/private',
    ]);
  });
});
