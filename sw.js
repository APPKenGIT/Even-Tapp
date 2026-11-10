const CACHE_NAME = 'eventapp-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon.ico'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first, fallback to cache for offline support
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// --- PUSH & TOESTEL-NOTIFICATIES ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Focus bestaand venster of open nieuw venster
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});

self.addEventListener('push', (event) => {
  let title = "Even'Tapp";
  let body = "Nieuwe melding in Even'Tapp! Tik om te bekijken.";

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
    } catch (e) {
      body = event.data.text() || body;
    }
  }

  const options = {
    body: body,
    icon: 'icon-192.png',
    badge: 'favicon-32.png',
    vibrate: [200, 100, 200],
    tag: 'eventapp-update',
    renotify: true,
    data: { url: './index.html' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
