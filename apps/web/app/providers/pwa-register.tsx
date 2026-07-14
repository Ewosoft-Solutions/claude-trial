'use client';

/* ============================================================
   PwaRegister — registers the service worker and surfaces an
   "update available" prompt.

   Registers only in production so `next dev` HMR is never shadowed
   by the cache. The SW is network-first for navigations, so it can't
   serve stale app content — but an installed PWA uses client-side
   routing and never cold-starts, so a freshly deployed worker would
   otherwise sit unused until the user quits and relaunches.

   The flow (the standard Workbox "waiting worker" pattern):
     1. A new worker installs and waits (sw.js no longer auto-skips).
     2. We detect it (on register, on `updatefound`, or already-waiting)
        and show a dismissible banner.
     3. On "Reload" we post SKIP_WAITING; the worker activates, fires
        `controllerchange`, and we reload once into the new version.
     4. Long-lived sessions poll `registration.update()` on an interval
        and whenever the app regains focus, so the banner can appear
        without a cold start.
   ============================================================ */

import * as React from 'react';
import { RefreshCw, X } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

export function PwaRegister() {
  const [waiting, setWaiting] = React.useState<ServiceWorker | null>(null);
  // Guards the `controllerchange` reload so the first-install `clients.claim()`
  // (which also fires controllerchange) never reloads the page — we reload
  // only after the user has explicitly accepted an update.
  const acceptedRef = React.useRef(false);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let reloading = false;

    const onControllerChange = () => {
      if (!acceptedRef.current || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    );

    // Only prompt for a genuine update — an existing controller means the app
    // is already running a previous version. Skip the very first install.
    const promptFor = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) setWaiting(worker);
    };

    const trackInstalling = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') promptFor(worker);
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        if (reg.waiting) promptFor(reg.waiting); // installed while app was closed
        if (reg.installing) trackInstalling(reg.installing);
        reg.addEventListener('updatefound', () => {
          if (reg.installing) trackInstalling(reg.installing);
        });
      })
      .catch(() => {
        // Registration failures are non-fatal: the app still works online.
      });

    const checkForUpdate = () => registration?.update().catch(() => {});
    const interval = window.setInterval(
      checkForUpdate,
      UPDATE_CHECK_INTERVAL_MS,
    );
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, []);

  const reload = React.useCallback(() => {
    acceptedRef.current = true;
    waiting?.postMessage('SKIP_WAITING');
    // Fallback in case `controllerchange` doesn't fire (e.g. the worker was
    // already active): reload shortly after so the user is never stuck.
    window.setTimeout(() => window.location.reload(), 2500);
  }, [waiting]);

  if (!waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[60] mx-auto flex w-[min(24rem,calc(100%-2rem))] items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3 shadow-lg"
    >
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
        aria-hidden
      >
        <RefreshCw className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          Update available
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Reload to get the latest version.
        </p>
      </div>
      <Button size="sm" onClick={reload}>
        Reload
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setWaiting(null)}
        aria-label="Dismiss update notification"
      >
        <X />
      </Button>
    </div>
  );
}
