/**
 * Client-side PWA / web-push helpers.
 *
 * Service-worker registration and push subscription. Backend push *delivery*
 * (VAPID signing + fan-out) is a separate concern; `subscribeToPush` produces
 * the PushSubscription a backend would persist and send to.
 */

/** Convert a base64url VAPID public key to the Uint8Array the Push API wants. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Register the service worker. No-op (returns null) when unsupported. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/**
 * Subscribe the current registration to web push, reusing any existing
 * subscription. Returns null when push is unsupported or permission is denied.
 */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscription | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  const reg = await navigator.serviceWorker.ready;
  if (!('pushManager' in reg)) return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    // Cast: the Push API types want BufferSource; a Uint8Array<ArrayBufferLike>
    // is byte-compatible but trips the ArrayBuffer/SharedArrayBuffer strictness.
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}
