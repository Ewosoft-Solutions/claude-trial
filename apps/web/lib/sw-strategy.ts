/**
 * The caching decision the service worker makes for a request. Extracted here
 * as a pure function so it can be unit-tested; `public/sw.js` mirrors this
 * logic (keep the two in sync).
 */
export type SwStrategy = 'bypass' | 'network-first' | 'stale-while-revalidate';

export interface SwRequestInfo {
  method: string;
  /** Same-origin flag (sw.js checks url.origin === self.location.origin). */
  sameOrigin: boolean;
  pathname: string;
  /** Request mode; 'navigate' for page loads. */
  mode?: string;
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname === '/icon.svg' ||
    pathname === '/manifest.webmanifest'
  );
}

export function cacheStrategyFor(req: SwRequestInfo): SwStrategy {
  // Never intercept non-GET, cross-origin, or API/auth traffic.
  if (req.method !== 'GET' || !req.sameOrigin || req.pathname.startsWith('/api/')) {
    return 'bypass';
  }
  if (req.mode === 'navigate') return 'network-first';
  if (isStaticAsset(req.pathname)) return 'stale-while-revalidate';
  return 'bypass';
}
