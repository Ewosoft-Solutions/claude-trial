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
   `jsonFetcher` forwards it to `authedFetch` → `fetch`. When WE abort a
   read (a newer request superseded it, or the component unmounted), the
   fetch rejects with an AbortError ("signal is aborted without reason").
   SWR does NOT reliably discard that rejection — on pane mount, a focus
   revalidation, or a React StrictMode double-invoke it can land in SWR's
   `error` field and surface to the user (e.g. the AI workspace showed
   "signal is aborted without reason"). So we swallow any rejection whose
   controller we deliberately aborted, returning a promise that never
   settles: SWR neither records an error nor clobbers fresher data, and
   the request that triggered the abort resolves normally. Genuine fetch
   failures (signal not aborted) propagate unchanged. Mutations are
   unaffected — this only wraps the read fetcher.
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
            return Promise.resolve(
              (fetcher as (...a: unknown[]) => unknown)(...args, {
                signal: controller.signal,
              }),
            ).catch((error: unknown) => {
              // A read we aborted on purpose is not a failure to report.
              if (controller.signal.aborted) {
                return new Promise<never>(() => {});
              }
              throw error;
            });
          }
        : fetcher;

    React.useEffect(() => {
      return () => controllerRef.current?.abort();
    }, []);

    return useSWRNext(key, wrappedFetcher as typeof fetcher, config);
  };
