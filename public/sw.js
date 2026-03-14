/* SkyHelper Service Worker — handles background push notifications */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* ignore malformed push data */ }

  const title   = data.title   ?? '🔔 SkyHelper Alert';
  const body    = data.body    ?? 'A price alert has been triggered.';
  const url     = data.url     ?? '/alerts';
  const icon    = data.icon    ?? '/favicon.svg';
  const badge   = data.badge   ?? '/favicon.svg';
  const tag     = data.tag     ?? 'skyhelper-alert';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      data: { url },
      actions: [
        { action: 'open',    title: 'View Alerts' },
        { action: 'dismiss', title: 'Dismiss'     },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url ?? '/alerts';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one is open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
