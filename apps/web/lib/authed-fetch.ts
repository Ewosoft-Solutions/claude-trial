let refreshInFlight: Promise<RefreshResult> | null = null;

const SHARED_REFRESH_STATE_KEY = 'swe:session-refresh:v1';
const SHARED_REFRESH_LOCK_NAME = 'swe:session-refresh';
const SHARED_REFRESH_MAX_AGE_MS = 10_000;

export interface RefreshResult {
  success: boolean;
  accessExpiresAt?: number;
  failure?: 'unauthorized' | 'unavailable';
}

function readRecentSharedRefresh(): RefreshResult | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(SHARED_REFRESH_STATE_KEY) ?? 'null',
    ) as {
      version?: number;
      refreshedAt?: number;
      accessExpiresAt?: number;
    } | null;
    if (
      value?.version !== 1 ||
      typeof value.refreshedAt !== 'number' ||
      Date.now() - value.refreshedAt > SHARED_REFRESH_MAX_AGE_MS
    ) {
      return null;
    }
    return { success: true, accessExpiresAt: value.accessExpiresAt };
  } catch {
    return null;
  }
}

function writeSharedRefresh(accessExpiresAt?: number) {
  try {
    localStorage.setItem(
      SHARED_REFRESH_STATE_KEY,
      JSON.stringify({
        version: 1,
        refreshedAt: Date.now(),
        accessExpiresAt,
      }),
    );
  } catch {
    // Restricted browser storage only removes the cross-tab optimisation.
  }
}

async function requestRefresh(): Promise<RefreshResult> {
  return fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then(async (response): Promise<RefreshResult> => {
      if (!response.ok) {
        return {
          success: false,
          failure: response.status === 401 ? 'unauthorized' : 'unavailable',
        };
      }
      const body = (await response.json().catch(() => ({}))) as {
        accessExpiresAt?: number;
      };
      writeSharedRefresh(body.accessExpiresAt);
      return { success: true, accessExpiresAt: body.accessExpiresAt };
    })
    .catch((): RefreshResult => ({ success: false, failure: 'unavailable' }));
}

async function coordinateRefreshAcrossTabs(): Promise<RefreshResult> {
  const recent = readRecentSharedRefresh();
  if (recent) return recent;

  const locks =
    typeof navigator !== 'undefined' && 'locks' in navigator
      ? navigator.locks
      : undefined;
  if (!locks) return requestRefresh();

  try {
    return await locks.request(SHARED_REFRESH_LOCK_NAME, async () => {
      // Another tab may have refreshed while this tab waited for the lock.
      return readRecentSharedRefresh() ?? requestRefresh();
    });
  } catch {
    // Web Locks may be disabled in a restricted webview. Refreshing directly
    // is still safe; the backend accepts the fixed, non-rotating refresh token.
    return requestRefresh();
  }
}

/** Deduplicated in this tab and, where supported, across same-origin tabs. */
export async function refreshBrowserSession(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = coordinateRefreshAcrossTabs()
      .then((result) => {
        if (
          result.success &&
          result.accessExpiresAt &&
          typeof window !== 'undefined'
        ) {
          window.dispatchEvent(
            new CustomEvent('swe:session-refreshed', {
              detail: { accessExpiresAt: result.accessExpiresAt },
            }),
          );
        }
        return result;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

/** Retry one same-origin application API request after a successful refresh. */
export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  const retryInput = isRequest ? input.clone() : input;
  const response = await fetch(input, init);
  const url = isRequest ? input.url : input.toString();
  if (
    response.status !== 401 ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout')
  ) {
    return response;
  }

  const refreshed = await refreshBrowserSession();
  if (!refreshed.success && refreshed.failure === 'unauthorized') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('swe:session-expired'));
    }
  }
  if (!refreshed.success) return response;

  const retried = await fetch(retryInput, init);
  if (retried.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('swe:session-expired'));
  }
  return retried;
}
