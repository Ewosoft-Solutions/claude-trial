'use client';

/* ============================================================
   PwaRegister — registers the service worker on the client.

   Registers only in production so `next dev` HMR is never shadowed
   by the cache. The SW is network-first for navigations, so it can't
   serve stale app content — it only adds an offline fallback and
   static-asset caching. Renders nothing.
   ============================================================ */

import * as React from 'react';
import { registerServiceWorker } from '@/lib/push';

export function PwaRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    void registerServiceWorker();
  }, []);
  return null;
}
