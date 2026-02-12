
const CACHE_NAME = 'math-nav-cache-v2.1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/vite.svg',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2JL7W0Q5n-wU.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js',
  'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
  'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  'https://unpkg.com/intro.js/introjs.css',
  'https://unpkg.com/intro.js/intro.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching all: app shell and content');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((err) => {
          console.error('[Service Worker] Cache addAll failed:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignore non-http/https requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // 1. Network Only for API/Firebase
  if (url.pathname.startsWith('/api/') || url.href.includes('firestore') || url.href.includes('googleapis')) {
    return;
  }

  // 2. Navigation: Network First -> Cache -> Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
                // Scheme check to avoid chrome-extension:// errors
                if (event.request.url.startsWith('http')) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            });
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              return caches.match('/');
          });
        })
    );
    return;
  }

  // 3. Assets: Cache First -> Network -> Update Cache
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (event.request.url.startsWith('http')) {
            cache.put(event.request, responseToCache);
          }
        });
        return networkResponse;
      });
    })
  );
});
