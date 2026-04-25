const CACHE = 'muscu-j2b-v1';
const ASSETS = ['./', './index.html', './manifest.json',
  './favicon-96x96.png', './web-app-manifest-192x192.png', './web-app-manifest-512x512.png'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
