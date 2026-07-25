'use client';

/* ============================================================
   SwrProvider — app-wide SWR defaults.

   Wires the shared JSON fetcher and the revalidation policy that
   keeps a long-lived (installed PWA) session showing fresh data:
     • revalidateOnFocus     — refetch when the user returns to the app
     • revalidateOnReconnect  — refetch when the network comes back
   `keepPreviousData` means those background refetches swap data in
   place without flashing a loading state, and `dedupingInterval`
   coalesces duplicate reads of the same endpoint fired together.

   Mounted in the authenticated (app) layout so only signed-in,
   data-driven surfaces inherit it — the login screen doesn't.
   ============================================================ */

import * as React from 'react';
import { SWRConfig } from 'swr';

import { jsonFetcher } from '@/lib/fetcher';
import { abortOnUnmount } from '@/lib/swr-abort';

export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: jsonFetcher,
        // Cancel a read's HTTP request when its component unmounts (e.g. the
        // user navigates away) so it stops holding a connection / API work.
        use: [abortOnUnmount],
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        keepPreviousData: true,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
