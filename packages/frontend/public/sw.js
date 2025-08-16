// Cartrita PWA Service Worker
// Provides offline capability, caching, and background sync

const CACHE_NAME = 'cartrita-v1.0.1';
const STATIC_CACHE = 'cartrita-static-v1.0.1';
const DYNAMIC_CACHE = 'cartrita-dynamic-v1.0.1';
const API_CACHE = 'cartrita-api-v1.0.1';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  // Core scripts and styles will be added by build process
];

// API endpoints to cache
const CACHEABLE_APIS = [
  '/api/auth/verify',
  '/api/chat/history',
  '/api/workflows/list',
  '/api/user/settings'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Vite dev resources entirely in development
  if (url.pathname.includes('/node_modules/.vite/') || 
      url.pathname.includes('/@vite/') ||
      url.pathname.includes('/@fs/') ||
      url.pathname.includes('/__vite_ping') ||
      (url.pathname.includes('/src/') && url.search.includes('?'))) {
    // Let Vite handle these directly without SW intervention
    return;
  }

  // Handle API requests (all methods)
  if (url.pathname.startsWith('/api/')) {
    // In development mode, let Vite proxy handle API requests
    // Only intercept in production or when explicitly needed
    if (self.location.hostname === 'localhost' && self.location.port === '3000') {
      // Development mode - let Vite proxy handle this
      return;
    }
    // API requests - handle all HTTP methods
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Skip non-GET requests for non-API calls
  if (request.method !== 'GET') {
    return;
  }

  // Handle different resource types with appropriate strategies
  if (isStaticAsset(url.pathname)) {
    // Static assets - Cache First
    event.respondWith(handleStaticAsset(request));
  } else {
    // HTML pages - Stale While Revalidate
    event.respondWith(handlePageRequest(request, event));
  }
});

// Network First strategy for API requests
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Construct the proper backend URL for development
    let apiUrl = request.url;
    
    // If the request is coming from the frontend (localhost:3000) 
    // and targeting /api/, redirect to backend (localhost:8001)
    if (url.hostname === 'localhost' && url.port === '3000' && url.pathname.startsWith('/api/')) {
      apiUrl = `http://localhost:8001${url.pathname}${url.search}`;
    }
    
    // Create a new request with the correct URL and proper options
    const requestOptions = {
      method: request.method,
      headers: request.headers,
      mode: 'cors',
      credentials: 'include'
    };
    
    // Add body and duplex for non-GET requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      requestOptions.body = request.body;
      // Add duplex for streaming bodies (required for modern browsers)
      if (request.body instanceof ReadableStream) {
        requestOptions.duplex = 'half';
      }
    }
    
    const apiRequest = new Request(apiUrl, requestOptions);
    
    // Try network first with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const networkResponse = await fetch(apiRequest, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Cache successful responses for certain endpoints
    if (networkResponse.ok && CACHEABLE_APIS.some(api => url.pathname.startsWith(api))) {
      const cache = await caches.open(API_CACHE);
      // Clone response before caching
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] API request failed:', request.url, 'Error:', error);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving API from cache:', request.url);
      return cachedResponse;
    }
    
    // Return offline response for specific endpoints
    if (url.pathname.startsWith('/api/chat/')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Offline mode - chat functionality limited',
        offline: true
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503
      });
    }
    
    // For other API endpoints, return a generic error response instead of throwing
    return new Response(JSON.stringify({
      success: false,
      error: 'Service temporarily unavailable',
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    });
  }
}

// Cache First strategy for static assets
async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Serve from cache
    return cachedResponse;
  }
  
  try {
    // Not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Only cache HTTP/HTTPS requests, skip unsupported schemes
      const url = new URL(request.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        try {
          const cache = await caches.open(DYNAMIC_CACHE);
          await cache.put(request, networkResponse.clone());
        } catch (cacheError) {
          console.warn('[SW] Failed to cache asset:', request.url, cacheError.message);
        }
      }
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed and not in cache
    console.log('[SW] Failed to fetch static asset:', request.url);
    throw error;
  }
}

// Stale While Revalidate for HTML pages
async function handlePageRequest(request, event) {
  const cachedResponse = await caches.match(request);
  
  // Serve from cache immediately if available
  const responsePromise = cachedResponse || fetch(request);
  
  // Update cache in background
  event.waitUntil(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const cache = caches.open(DYNAMIC_CACHE);
          cache.then(c => c.put(request, networkResponse.clone()));
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed, fallback handled by responsePromise
      })
  );
  
  try {
    return await responsePromise;
  } catch (error) {
    // Serve offline page if available
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Ultimate fallback
    return new Response('Offline - Please check your connection', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Helper function to identify static assets
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.ico', '.json'
  ];
  
  // Skip Vite dev dependencies and HMR files in development
  if (pathname.includes('/node_modules/.vite/') || 
      pathname.includes('/@vite/') ||
      pathname.includes('/@fs/') ||
      pathname.includes('/__vite_ping') ||
      pathname.includes('/src/') && pathname.includes('?')) {
    return false;
  }
  
  return staticExtensions.some(ext => pathname.endsWith(ext)) || 
         pathname.startsWith('/icons/') ||
         pathname.startsWith('/assets/');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'chat-messages') {
    event.waitUntil(syncChatMessages());
  } else if (event.tag === 'user-settings') {
    event.waitUntil(syncUserSettings());
  }
});

// Sync queued chat messages when online
async function syncChatMessages() {
  try {
    // Get queued messages from IndexedDB (would need to implement storage layer)
    console.log('[SW] Syncing chat messages...');
    // Implementation would depend on offline storage strategy
  } catch (error) {
    console.error('[SW] Failed to sync chat messages:', error);
  }
}

// Sync user settings when online
async function syncUserSettings() {
  try {
    console.log('[SW] Syncing user settings...');
    // Implementation would depend on offline storage strategy
  } catch (error) {
    console.error('[SW] Failed to sync user settings:', error);
  }
}

// Handle push notifications (if implemented)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'You have a new message from Cartrita',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open Chat'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      options.body = payload.message || options.body;
      options.data = payload.data || options.data;
    } catch (error) {
      console.error('[SW] Failed to parse push payload:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('Cartrita AI', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        
        // Open new window
        return clients.openWindow(data.url || '/');
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}
