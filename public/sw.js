const CACHE = 'pockit-shell-v2'
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest'])),
  )
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  )
  self.clients.claim()
})
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  const shell = url.pathname === '/'
  const asset =
    url.pathname.startsWith('/assets/') ||
    ['/icon.svg', '/icon-192.png', '/manifest.webmanifest'].includes(url.pathname)
  if (!shell && !asset) return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)))
        }
        return response
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || (shell ? caches.match('/') : undefined)),
      ),
  )
})
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    /* Use the private default. */
  }
  event.waitUntil(
    self.registration.showNotification('Pockit reminder', {
      body: typeof payload.body === 'string' ? payload.body : 'Open Pockit to check your bills.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'pockit-bill-reminder',
      data: { url: '/?open=calendar' },
    }),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || '/'))
})
