// Minimal service worker for PWA installability (Wealth SaaS)
const CACHE_NAME = 'wealth-saas-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Network-first; no offline cache for now (app requires API)
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
})
