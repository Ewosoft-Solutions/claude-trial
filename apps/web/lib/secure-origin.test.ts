import { describe, expect, it } from 'vitest';

import { buildHttpsRedirectUrl, shouldRedirectToHttps } from './secure-origin';

describe('shouldRedirectToHttps', () => {
  it('redirects a tunneled HTTP origin to HTTPS', () => {
    expect(shouldRedirectToHttps('swe-dev.schoolwithease.com', 'http')).toBe(
      true,
    );
  });

  it('does not redirect HTTPS or local development', () => {
    expect(shouldRedirectToHttps('swe-dev.schoolwithease.com', 'https')).toBe(
      false,
    );
    expect(shouldRedirectToHttps('localhost:3001', 'http')).toBe(false);
    expect(shouldRedirectToHttps('127.0.0.1:3001', 'http')).toBe(false);
  });

  it('does not leak the local Next.js origin port into the public redirect', () => {
    expect(
      buildHttpsRedirectUrl(
        'http://localhost:3001/login',
        'swe-dev.schoolwithease.com:3001',
      ).toString(),
    ).toBe('https://swe-dev.schoolwithease.com/login');
  });
});
