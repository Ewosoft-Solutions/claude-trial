import { describe, expect, it } from 'vitest';
import { cacheStrategyFor } from './sw-strategy';
import { urlBase64ToUint8Array } from './push';

const base = { method: 'GET', sameOrigin: true };

describe('cacheStrategyFor', () => {
  it('bypasses non-GET, cross-origin, and API/auth requests', () => {
    expect(cacheStrategyFor({ ...base, method: 'POST', pathname: '/x' })).toBe('bypass');
    expect(cacheStrategyFor({ ...base, sameOrigin: false, pathname: '/x' })).toBe('bypass');
    expect(cacheStrategyFor({ ...base, pathname: '/api/auth/login' })).toBe('bypass');
  });

  it('uses network-first for navigations (no stale app content)', () => {
    expect(cacheStrategyFor({ ...base, pathname: '/overview', mode: 'navigate' })).toBe(
      'network-first',
    );
  });

  it('caches static build assets stale-while-revalidate', () => {
    expect(cacheStrategyFor({ ...base, pathname: '/_next/static/chunk.js' })).toBe(
      'stale-while-revalidate',
    );
    expect(cacheStrategyFor({ ...base, pathname: '/icon.svg' })).toBe(
      'stale-while-revalidate',
    );
  });

  it('bypasses other same-origin GETs by default', () => {
    expect(cacheStrategyFor({ ...base, pathname: '/some/data' })).toBe('bypass');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url VAPID key to bytes', () => {
    // "hello" in base64url is "aGVsbG8".
    const bytes = urlBase64ToUint8Array('aGVsbG8');
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it('handles url-safe chars and missing padding', () => {
    // Bytes [251, 255] → base64 "+/8=" → base64url "-_8".
    const bytes = urlBase64ToUint8Array('-_8');
    expect(Array.from(bytes)).toEqual([251, 255]);
  });
});
