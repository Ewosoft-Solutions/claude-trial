import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiErrorBody } from './api-client';

/**
 * Pins the error-hygiene contract (mirrors the API's http-exception.filter
 * spec): a transport failure must be classified rather than surfacing as an
 * opaque 500, and internal detail must never reach the client unless
 * API_DEBUG_ERRORS is explicitly "true".
 */
describe('apiErrorBody', () => {
  const original = process.env.API_DEBUG_ERRORS;

  afterEach(() => {
    process.env.API_DEBUG_ERRORS = original;
  });

  it('omits internal detail by default', () => {
    delete process.env.API_DEBUG_ERRORS;
    expect(apiErrorBody('Upstream API unreachable', 'ECONNREFUSED 10.0.0.1')).toEqual({
      error: 'Upstream API unreachable',
    });
  });

  it('omits internal detail for any value other than "true"', () => {
    // Unset principle: NODE_ENV must not be able to opt in on its own.
    for (const value of ['1', 'yes', 'TRUE', '']) {
      process.env.API_DEBUG_ERRORS = value;
      expect(apiErrorBody('boom', 'secret host detail')).toEqual({ error: 'boom' });
    }
  });

  it('includes internal detail only under API_DEBUG_ERRORS=true', () => {
    process.env.API_DEBUG_ERRORS = 'true';
    expect(apiErrorBody('boom', 'secret host detail')).toEqual({
      error: 'boom',
      internalMessage: 'secret host detail',
    });
  });

  it('never invents an internalMessage key when there is no detail', () => {
    process.env.API_DEBUG_ERRORS = 'true';
    expect(apiErrorBody('boom')).toEqual({ error: 'boom' });
  });
});

describe('request() transport failures', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /** Re-import with a chosen base URL, since API_BASE is module-level. */
  async function clientWithBase(base: string) {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = base;
    return import('./api-client');
  }

  it('classifies an unreachable upstream as 502, not 500', async () => {
    const { apiClient, ApiError: Err } = await clientWithBase('https://api.example.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    const error = (await apiClient.get('/anything').catch((e) => e)) as ApiError;

    expect(error).toBeInstanceOf(Err);
    expect(error.status).toBe(502);
    expect(error.message).toBe('Upstream API unreachable');
    // The operator-facing half names the offending config.
    expect(error.internalMessage).toContain('https://api.example.test/anything');
    expect(error.internalMessage).toContain('NEXT_PUBLIC_API_URL');
    vi.unstubAllGlobals();
  });

  it('classifies a malformed base URL as 502 with the value that broke it', async () => {
    // The real-world case: NEXT_PUBLIC_API_URL set without a scheme.
    const { apiClient } = await clientWithBase('api.example.test');
    const error = (await apiClient.get('/anything').catch((e) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.internalMessage).toContain('api.example.test');
  });

  it('still forwards a real upstream status untouched', async () => {
    const { apiClient } = await clientWithBase('https://api.example.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      ),
    );

    const error = (await apiClient.get('/anything').catch((e) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(error.message).toBe('Unauthorized');
    // Upstream messages are already client-safe; no internal detail is attached.
    expect(error.internalMessage).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('logs the cause server-side so an operator can see it', async () => {
    const { apiClient } = await clientWithBase('https://api.example.test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await apiClient.get('/anything').catch(() => undefined);

    expect(console.error).toHaveBeenCalledWith(
      '[api-client] upstream unreachable:',
      expect.stringContaining('fetch failed'),
      expect.any(TypeError),
    );
    vi.unstubAllGlobals();
  });
});

describe('ApiError', () => {
  it('carries internalMessage separately from the client message', () => {
    const err = new ApiError(502, 'Upstream API unreachable', 'ECONNREFUSED');
    expect(err.message).toBe('Upstream API unreachable');
    expect(err.internalMessage).toBe('ECONNREFUSED');
    expect(err.name).toBe('ApiError');
  });
});
