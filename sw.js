const CACHE_NAME = 'ledger-cache-v27';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './notification-badge.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Force a real network fetch for each core asset, bypassing the browser's
      // HTTP cache. cache.addAll() alone does a plain fetch() under the hood,
      // which can silently hand back a stale cached copy of index.html even
      // during an "update" — this is why updates weren't reliably reaching
      // the phone before. { cache: 'reload' } skips that.
      Promise.all(CORE_ASSETS.map((url) =>
        fetch(url, { cache: 'reload' }).then((response) => cache.put(url, response))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for CDN scripts so you always get the latest Tailwind/Chart.js;
  // cache-first for the app's own files so it works offline.
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
