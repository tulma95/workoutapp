const CACHE_NAME = 'setforge-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add('/')).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Pass through API requests without caching
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For navigate requests: network first, fallback to cached '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // For all other requests: cache first, then fetch and cache
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification('SetForge', {
      body: data.message ?? 'New notification',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.type ?? 'generic',
      data: { url: data.url ?? '/' }
    })
  );
});

// Notification click: focus an existing window or open a new one.
// Note: this handler is not covered by E2E tests because headless browsers
// do not support the Notification API in a way that allows click simulation.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(url).then((c) => (c ?? client).focus());
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
