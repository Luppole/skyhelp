/**
 * Push notification utilities.
 * Registers the service worker and manages the PushSubscription lifecycle.
 *
 * Setup required:
 *   1. Generate VAPID keys:  python -c "from pywebpush import Vapid; v=Vapid(); v.generate_keys(); print('PUBLIC:', v.public_key); print('PRIVATE:', v.private_key)"
 *   2. Add VITE_VAPID_PUBLIC_KEY=<public key> to .env
 *   3. Add VAPID_PRIVATE_KEY=<private key> and VAPID_EMAIL=mailto:you@example.com to backend .env
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/** Register (or return existing) service worker. */
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

/** Get the current PushSubscription, or null if not subscribed. */
export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Subscribe to push notifications.
 * Returns the PushSubscription, or null on failure.
 */
export async function subscribeToPush() {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY not set — push disabled');
    return null;
  }
  try {
    const reg = await registerSW();
    if (!reg) return null;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return sub;
  } catch (err) {
    console.warn('[push] subscribe failed:', err);
    return null;
  }
}

/** Send the subscription to our backend so it can deliver notifications. */
export async function sendSubscriptionToServer(subscription, userId) {
  if (!subscription || !userId) return;
  try {
    await fetch('/api/push/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription: subscription.toJSON(), user_id: userId }),
    });
  } catch (err) {
    console.warn('[push] failed to send subscription to server:', err);
  }
}

/** Remove push subscription from browser and server. */
export async function unsubscribeFromPush(userId) {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  await sub.unsubscribe();
  try {
    await fetch('/api/push/unsubscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ endpoint: sub.endpoint, user_id: userId }),
    });
  } catch {}
}
