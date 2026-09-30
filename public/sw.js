const CACHE_NAME = 'wa-quote-v2';
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/CHN QUOTEDESK.png',
  '/chn-logo.png',
  '/favicon.ico'
];

// Install — precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Don't fail install if any single asset can't be cached
      Promise.all(PRECACHE_URLS.map((u) => cache.add(u).catch(() => null)))
    )
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache, then to a synthetic offline response
self.addEventListener('fetch', (event) => {
  // Skip non-GET and API/auth requests entirely (let browser handle them)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/') ||
    url.pathname.startsWith('/_next/data/')
  ) {
    return;
  }

  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
  try {
    const response = await fetch(request);
    // Cache successful same-origin responses
    if (response && response.ok && response.type === 'basic') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch (err) {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort: an empty 503 so respondWith doesn't crash
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable (offline)',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
