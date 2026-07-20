import { describe, expect, it } from 'vitest';

import {
  buildCanonicalHostRedirectUrl,
  buildHttpsRedirectUrl,
  shouldRedirectToHttps,
} from './secure-origin';

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

describe('buildCanonicalHostRedirectUrl', () => {
  it('redirects the www alias to the canonical HTTPS origin', () => {
    expect(
      buildCanonicalHostRedirectUrl(
        'http://localhost:3001/account/security?tab=passkeys',
        'www.schoolwithease.com',
        'https://schoolwithease.com',
      )?.toString(),
    ).toBe('https://schoolwithease.com/account/security?tab=passkeys');
  });

  it('does not redirect the canonical host or service subdomains', () => {
    expect(
      buildCanonicalHostRedirectUrl(
        'https://schoolwithease.com/login',
        'schoolwithease.com',
        'https://schoolwithease.com',
      ),
    ).toBeNull();
    expect(
      buildCanonicalHostRedirectUrl(
        'https://api.schoolwithease.com/health',
        'api.schoolwithease.com',
        'https://schoolwithease.com',
      ),
    ).toBeNull();
  });

  it('ignores missing or unsafe canonical configuration', () => {
    expect(
      buildCanonicalHostRedirectUrl(
        'https://www.schoolwithease.com/login',
        'www.schoolwithease.com',
        undefined,
      ),
    ).toBeNull();
    expect(
      buildCanonicalHostRedirectUrl(
        'https://www.schoolwithease.com/login',
        'www.schoolwithease.com',
        'http://schoolwithease.com',
      ),
    ).toBeNull();
  });
});
