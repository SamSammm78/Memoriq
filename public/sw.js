const CACHE_NAME = 'memoriq-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/data/quran.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-icon.png'
];

// Installation: cache all primary resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets...');
      // We use map to cache items individually so that one failure doesn't block the rest
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(asset => 
          cache.add(asset).catch(err => console.warn(`Failed to cache ${asset}:`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activation: clean up older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetching: cache-first with stale-while-revalidate for local assets, ignore API routes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude API routes, audio files, and non-GET requests from general caching
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET' || url.hostname.includes('everyayah.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});

// Listen for Push Notification events
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  let payload = {
    title: 'Memoriq',
    body: 'C\'est l\'heure de votre session de mémorisation !',
    url: '/'
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url || '/'
    },
    actions: [
      { action: 'open', title: 'Ouvrir Memoriq' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle Notification Clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification Clicked.');
  event.notification.close();

  const targetUrl = event.notification.data ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find a tab with matching url and focus it
      for (const client of clientList) {
        if (client.url === new URL(targetUrl, self.location.origin).href && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
