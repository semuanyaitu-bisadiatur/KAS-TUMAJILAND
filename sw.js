// ===== SERVICE WORKER + VERSION CONTROL =====
const CACHE_NAME = 'kas-perumahan-v1-0-0'; // ← GANTI setiap update
const APP_VERSION = '1.0.0'; // ← SAMAKAN dengan app.js
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css?v=1.0.0',  // ← SAMAKAN versi
  '/app.js?v=1.0.0'      // ← SAMAKAN versi
];

// Install: cache file
self.addEventListener('install', event => {
  self.skipWaiting(); // Langsung aktif, tunggu tidak perlu
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate: hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: ambil dari network dulu, fallback ke cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Update cache dengan versi terbaru
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Listen message dari app.js untuk cek versi
self.addEventListener('message', event => {
  if (event.data === 'CHECK_VERSION') {
    event.ports[0].postMessage({
      version: APP_VERSION,
      cacheName: CACHE_NAME
    });
  }
  
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
