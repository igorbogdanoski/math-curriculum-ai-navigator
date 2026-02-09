/// <reference lib="WebWorker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'math-nav-cache-v1.1'; // Increment version for cache busting
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/vite.svg',
  '/manifest.json',
  // Core libraries (from importmap or CDN)
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2JL7W0Q5n-wU.woff2', // font file
  
  // KaTeX for LaTeX
  'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js',
  
  // Vis.js for Network Graph
  'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js',
  
  // Pako.js for compression
  'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',

  // PptxGenJS for PowerPoint export
  'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',

  // Intro.js for Guided Tours
  'https://unpkg.com/intro.js/introjs.css',
  'https://unpkg.com/intro.js/intro.js',
  
  // Chart.js for Dashboard
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching assets');
        // Use addAll with a catch to prevent install failure on single asset failure
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error('Failed to cache assets during install:', err);
        });
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
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  // We only care about GET requests for caching assets.
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // For API calls, always go to the network.
  if (url.pathname.startsWith('/api/')) {
    // This worker no longer handles API calls, they will be handled by the mock service logic in the app.
    // We let them pass through to the browser.
    return;
  }

  // For HTML pages, use a network-first strategy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          // Also update cache with the latest version
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          console.log('Fetch for navigation failed; trying cache.', error);
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to the root index.html if the specific page isn't cached
          const rootFallback = await caches.match('/');
          if (rootFallback) {
              return rootFallback;
          }
          return new Response("Offline and page not in cache.", {
            status: 404,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })()
    );
    return;
  }

  // For all other assets, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return from cache if found
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache it
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
           const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      });
    })
  );
});

export {};