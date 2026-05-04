const CACHE = 'muscu-j2b-v9';
const ASSETS = ['./', './index.html', './styles.css', './data.js', './app.js', './manifest.json',
  './tuto.html', './lexique.html', './anatomie.html', './anatomie-muscles.png',
  './favicon-16x16.png', './favicon-32x32.png', './apple-touch-icon.png',
  './android-chrome-192x192.png', './android-chrome-512x512.png', './favicon.ico'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
