'use client';

/* ============================================================
   abortOnUnmount — SWR middleware for request cancellation

   SWR dedupes and ignores stale responses, but by default it does not
   abort the underlying HTTP request when the component that asked for
   the data unmounts. On a data-dense app that means navigating away
   mid-fetch leaves the request running: it keeps one of the browser's
   ~6 per-host connections busy (delaying the next page's reads) and
   keeps the upstream API doing work whose result is thrown away.

   This middleware gives every SWR hook its own AbortController and:
     • aborts the previous in-flight request when a newer one starts
       (revalidate-on-focus, key change) — latest-wins, and
     • aborts the current request when the component unmounts, e.g. the
       user navigates to another page.

   The fetcher receives the signal as a trailing `{ signal }` argument;
   `jsonFetcher` forwards it to `authedFetch` → `fetch`. Aborted reads
   reject with an AbortError that SWR discards as stale (a newer request
   has superseded it, or the component is gone), so nothing flashes an
   error. Mutations are unaffected — this only wraps the read fetcher.
   ============================================================ */

import * as React from 'react';
import type { Middleware, SWRHook } from 'swr';

export const abortOnUnmount: Middleware =
  (useSWRNext: SWRHook) => (key, fetcher, config) => {
    const controllerRef = React.useRef<AbortController | null>(null);

    const wrappedFetcher =
      typeof fetcher === 'function'
        ? (...args: unknown[]) => {
            controllerRef.current?.abort();
            const controller = new AbortController();
            controllerRef.current = controller;
            return (fetcher as (...a: unknown[]) => unknown)(...args, {
              signal: controller.signal,
            });
          }
        : fetcher;

    React.useEffect(() => {
      return () => controllerRef.current?.abort();
    }, []);

    return useSWRNext(key, wrappedFetcher as typeof fetcher, config);
  };
