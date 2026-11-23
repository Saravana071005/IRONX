/* IRONX Service Worker — High-Performance Gym Offline & PWA Caching (v3.0)
   - Precache critical application shell during install for instant 0ms offline availability
   - Infallible Navigation: Cache-First with background Stale-While-Revalidate (0ms startup latency on iOS Standalone PWA)
   - Cache-First for immutable, content-hashed assets (/assets/*) and exercise media (/img/*, /gif/*, /sounds/*, /fonts/*)
   - AbortController timeouts on all network fetches (no unbounded hanging on dormant backend)
   - Never cache authenticated /api/* endpoints or private user sessions
   - Safe cache eviction of legacy caches on activate
*/
const CACHE_NAME = 'ironx-v4.0';

const PRECACHE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'manifest.json?v=4',
  'icon-180.png',
  'icon-512.png',
  'favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'IRONX', {
      body: data.body || '',
      icon: 'icon-512.png',
      badge: 'icon-180.png',
      tag: data.tag || 'ironhouse',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const c = clients.find((client) => 'focus' in client);
      return c ? c.focus() : self.clients.openWindow('./');
    })
  );
});

// Fetch handler with optimized Cache-First for hashed assets and Instant Cache-First navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests from same origin
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // CRITICAL SECURITY RULE: Never intercept or cache authenticated API calls
  if (url.pathname.startsWith('/api/')) return;

  const isHashedAsset = url.pathname.includes('/assets/');
  const isMedia = url.pathname.includes('/img/') || url.pathname.includes('/gif/') || url.pathname.includes('/sounds/') || url.pathname.includes('/fonts/');

  // 1. Immutable versioned assets & media: CACHE-FIRST (Instant 0ms load)
  if (isHashedAsset || isMedia) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const response = await fetch(request, { signal: controller.signal });
          clearTimeout(timer);
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          return cached || new Response('Asset unavailable', { status: 504 });
        }
      })
    );
    return;
  }

  // 2. Navigation / HTML / App Shell: INSTANT CACHE with background Stale-While-Revalidate
  // This guarantees < 50ms startup on iPhone Safari Standalone PWA without blocking on dormant backend
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Match against request URL or known shell entries
        const cachedShell =
          (await cache.match(request)) ||
          (await cache.match('./')) ||
          (await cache.match('/')) ||
          (await cache.match('index.html'));

        // Background revalidation with strict timeout (2500ms)
        const fetchPromise = (async () => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2500);
            const response = await fetch(request, { signal: controller.signal });
            clearTimeout(timer);
            if (response && response.ok) {
              cache.put(request, response.clone());
              cache.put('index.html', response.clone());
            }
            return response;
          } catch {
            return null;
          }
        })();

        // If shell is cached, serve immediately!
        if (cachedShell) {
          event.waitUntil(fetchPromise);
          return cachedShell;
        }

        // First run before precache completes: wait for network up to 2500ms
        const netRes = await fetchPromise;
        if (netRes) return netRes;

        // Fallback offline shell
        return (
          (await cache.match('index.html')) ||
          new Response(
            '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>IRONX</title><style>body{background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head><body><div style="text-align:center"><h1>IRONX</h1><p>Offline - please check connection</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        );
      })
    );
    return;
  }

  // 3. All other static resources: Stale-While-Revalidate with fast abort
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const response = await fetch(request, { signal: controller.signal });
          clearTimeout(timer);
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached;
        }
      })();
      return cached || networkPromise;
    })
  );
});
