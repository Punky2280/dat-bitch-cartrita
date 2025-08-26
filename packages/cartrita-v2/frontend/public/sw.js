// Cartrita Service Worker
// Handles caching and offline functionality with safe error handling

const SW_VERSION = 'v2.0.0';
const STATIC_CACHE_NAME = `cartrita-static-${SW_VERSION}`;
const DYNAMIC_CACHE_NAME = `cartrita-dynamic-${SW_VERSION}`;

// Resources to cache immediately (avoid entries that 404 in dev)
const STATIC_RESOURCES = [
  '/',
  '/favicon.ico'
];

// Install event - cache static resources safely (no addAll failures)
self.addEventListener('install', (event) => {
  console.log('Cartrita Service Worker installing...');
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(STATIC_CACHE_NAME);
      console.log('Caching essential resources');
      for (const url of STATIC_RESOURCES) {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) await cache.put(url, res.clone());
        } catch (e) {
          console.warn('Skip caching (fetch failed):', url, e);
        }
      }
    } catch (err) {
      console.warn('Cache installation encountered issues:', err);
    }
    self.skipWaiting();
  })());
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Cartrita Service Worker activating...');
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map((name) => {
        if (name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME) {
          console.log('Deleting old cache:', name);
          return caches.delete(name);
        }
      })
    );
    await self.clients.claim();
  })());
});

// Fetch event - safe handler, never throws
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Bypass API, websockets, HMR, and Next chunks
  if (
    url.includes('/api/') ||
    url.includes('/ws/') ||
    url.includes('/_next/webpack-hmr') ||
    url.includes('/__nextjs_original-stack-frame') ||
    url.includes('/_next/static/')
  ) {
    return;
  }

  // Navigation requests: network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await caches.match(request);
        return cached || (await caches.match('/')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Static assets: cache-first
  if (request.destination === 'image' || request.destination === 'style' || request.destination === 'script' || url.endsWith('favicon.ico') || url.endsWith('manifest.json')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Fallback to a tiny empty icon for favicon to avoid console spam
        if (url.endsWith('favicon.ico')) {
          const emptyIco = new Blob([new Uint8Array([0x00,0x00,0x01,0x00,0x01,0x00,0x10,0x10,0x00,0x00,0x01,0x00,0x20,0x00,0x28,0x01,0x00,0x00,0x16,0x00,0x00,0x00])], { type: 'image/x-icon' });
          return new Response(emptyIco, { status: 200, headers: { 'Content-Type': 'image/x-icon' } });
        }
        return new Response('Offline', { status: 503 });
      }
    })());
  }
});