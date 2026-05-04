const CACHE = 'muscu-j2b-v9';
const ASSETS = ['./', './index.html', './styles.css', './data.js', './app.js', './manifest.json',
  './tuto.html', './lexique.html', './anatomie.html',
  './images/anatomie-muscles.png',
  './images/badge-carton-big.png', './images/badge-carton-small.png',
  './images/badge-bronze-big.png', './images/badge-bronze-small.png',
  './images/badge-argent-big.png', './images/badge-argent-small.png',
  './images/badge-or-big.png',    './images/badge-or-small.png',
  './favicon-16x16.png', './favicon-32x32.png', './apple-touch-icon.png',
  './android-chrome-192x192.png', './android-chrome-512x512.png', './favicon.ico'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
