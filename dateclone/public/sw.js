/**
 * DateClone Service Worker
 * Handles offline caching, background sync, and app updates
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `dateclone-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dateclone-dynamic-${CACHE_VERSION}`;
const API_CACHE = `dateclone-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `dateclone-images-${CACHE_VERSION}`;
const FONT_CACHE = `dateclone-fonts-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper: cache first, network fallback
function cacheFirst(request, cacheName, timeout = 3000) {
  return caches.open(cacheName).then((cache) => {
    return cache.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return Promise.race([
          fetchPromise,
          new Promise((resolve) => setTimeout(() => resolve(cachedResponse), timeout))
        ]);
      }
      return fetchAndCache(request, cache);
    });
  });
}

// Helper: network first, cache fallback
function networkFirst(request, cacheName) {
  return fetch(request).then((response) => {
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  }).catch(() => {
    return caches.match(request).then((cached) => {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('/offline.html');
      }
      return new Response('Offline', { status: 503 });
    });
  });
}

// Helper: fetch and cache
function fetchAndCache(request, cache) {
  return fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {
    return caches.match(request);
  });
}

// Helper: stale while revalidate
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) => {
    return cache.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    });
  });
}

// Fetch event - routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Images - cache first
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Fonts - cache first
  if (request.destination === 'font' || url.pathname.match(/\.(woff|woff2|ttf|eot)$/)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // JS/CSS - stale while revalidate
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Navigation - network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // Everything else - network first
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  }
});

async function syncMessages() {
  try {
    const db = await openDB();
    const pending = await db.getAll('pending-messages');
    for (const msg of pending) {
      try {
        const response = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg)
        });
        if (response.ok) {
          await db.delete('pending-messages', msg.id);
        }
      } catch (e) {
        console.error('Failed to sync message:', e);
      }
    }
  } catch (e) {
    console.error('Sync failed:', e);
  }
}

async function syncLikes() {
  try {
    const db = await openDB();
    const pending = await db.getAll('pending-likes');
    for (const like of pending) {
      try {
        const response = await fetch('/api/matches/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(like)
        });
        if (response.ok) {
          await db.delete('pending-likes', like.id);
        }
      } catch (e) {
        console.error('Failed to sync like:', e);
      }
    }
  } catch (e) {
    console.error('Sync likes failed:', e);
  }
}

// IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DateCloneSync', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending-likes')) {
        db.createObjectStore('pending-likes', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from DateClone',
      icon: '/pwa-icons/icon-192.svg',
      badge: '/pwa-icons/icon-192.svg',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        dateOfArrival: Date.now(),
        id: data.id
      },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'close', title: 'Dismiss' }
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'DateClone', options)
    );
  } catch (e) {
    console.error('Push notification error:', e);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handler for version check
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_VERSION') {
    event.source.postMessage({
      type: 'VERSION_CHECK',
      version: CACHE_VERSION
    });
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});