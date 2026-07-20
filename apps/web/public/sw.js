/* eslint-disable no-undef */
/**
 * School With Ease — service worker (PWA Phase 2).
 *
 * Strategy (kept conservative to never serve stale app content):
 *  - non-GET, cross-origin, and /api/* → always network, never cached.
 *  - navigations → network-first, falling back to the cached offline page
 *    only when the network fails (offline).
 *  - same-origin static build assets (/_next/static, icons) → cache-first
 *    with background refresh (stale-while-revalidate).
 *  - push + notificationclick handlers for web push.
 *
 * The caching decision here mirrors lib/sw-strategy.ts (unit-tested); keep
 * them in sync.
 */

const VERSION = 'v2';
const STATIC_CACHE = `swe-static-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  // NB: no unconditional self.skipWaiting(). A new worker stays in `waiting`
  // so the client can surface an "update available" prompt; it activates only
  // when the user accepts (see the SKIP_WAITING message handler below). This
  // is what lets an installed PWA update without a manual close-and-reopen.
});

// Activate immediately when the client tells us the user accepted the update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs; never cache API/auth or other methods.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'School With Ease', body: 'You have a new update.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: payload.url || '/overview' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/overview';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
