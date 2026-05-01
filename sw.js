// ============================================
// SW - VERSION AMBIL DARI GLOBAL VARIABLE
// ============================================

// Import version.js terlebih dahulu (via importScripts di production)
// Untuk sederhana, kita gunakan cara lain: fetch version.js

let SW_VERSION = '1.0.0';
let SW_CACHE_NAME = 'kas-perumahan-1-0-0';

// Fetch version.js untuk dapat versi terbaru
async function getVersion() {
    try {
        const response = await fetch('./version.js', { cache: 'no-store' });
        const text = await response.text();
        
        // Extract APP_VERSION dari text
        const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
            SW_VERSION = match[1];
            SW_CACHE_NAME = 'kas-perumahan-' + SW_VERSION.replace(/\./g, '-');
        }
    } catch(e) {
        console.log('Using default version');
    }
}

const urlsToCache = [
    './',
    './index.html',
    './version.js',
    './style.css',
    './app.js'
];

// Install
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        getVersion().then(() => {
            return caches.open(SW_CACHE_NAME).then(cache => cache.addAll(urlsToCache));
        })
    );
});

// Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== SW_CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const clone = response.clone();
                caches.open(SW_CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Message dari app
self.addEventListener('message', event => {
    if (event.data === 'CHECK_VERSION') {
        event.ports[0].postMessage({
            version: SW_VERSION,
            cacheName: SW_CACHE_NAME
        });
    }
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
