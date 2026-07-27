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
   SWR discards the rejection of a request that a newer one has already
   superseded, and never sets state after unmount — so in the common case
   nothing surfaces. It is NOT swallowed here into a never-settling promise:
   doing that leaves `isLoading` stuck true if the aborted read is the last
   one (e.g. a React StrictMode unmount aborts the sole in-flight fetch and
   deduping blocks an immediate refetch). Letting it reject keeps loading
   resolving and lets SWR retry to success; the few surfaces that can still
   see a transient AbortError (focus/StrictMode races) filter it at the
   display layer (`isAbortError`). Mutations are unaffected — read fetcher only.
   ============================================================ */

import * as React from 'react';
import type { Middleware, SWRHook } from 'swr';

/** True for the DOMException thrown when a fetch's AbortSignal fires. */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === 'AbortError'
      : (error as { name?: string } | null)?.name === 'AbortError'
  );
}

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
