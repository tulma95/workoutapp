/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  // Injected by vite-plugin-pwa (injectManifest) at build time.
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

// Precache the built app shell (content-hashed JS/CSS/HTML/icons). This is the
// whole point of the PWA: cold loads and reloads work offline on flaky gym
// wifi, instead of only caching assets opportunistically after a first online
// fetch. The manifest is injected by vite-plugin-pwa at build time.
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback: serve the precached index.html for any navigation
// that isn't an API call, so the app boots offline. API requests fall through
// to the network (and the app's own retry/cache logic) untouched.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//],
  }),
)

// Activate the new service worker immediately so an updated app shell takes
// effect on the next load rather than after all tabs close.
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// --- Web Push (behaviour unchanged from the previous hand-rolled sw.js) ---
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification('SetForge', {
      body: data.message ?? 'New notification',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.type ?? 'generic',
      data: { url: data.url ?? '/' },
    }),
  )
})

// Notification click: focus an existing window or open a new one.
// Not covered by E2E tests — headless browsers don't support click simulation
// on the Notification API.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(url).then((c) => (c ?? client).focus())
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
      return undefined
    }),
  )
})
