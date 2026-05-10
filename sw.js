const CACHE = 'muscu-j2b-v11';
const ASSETS = ['./', './index.html', './styles.css', './data.js', './app.js', './manifest.json',
  './tuto.html', './lexique.html', './anatomie.html',
  './images/anatomie-muscles.png',
  './images/haltere_orange.png', './images/haltere_dark.png', './images/haltere_dark2.png',
  './images/badge-carton-big.png', './images/badge-carton-small.png',
  './images/badge-bronze-big.png', './images/badge-bronze-small.png',
  './images/badge-argent-big.png', './images/badge-argent-small.png',
  './images/badge-or-big.png',    './images/badge-or-small.png',
  './favicon-16x16.png', './favicon-32x32.png', './apple-touch-icon.png',
  './android-chrome-192x192.png', './android-chrome-512x512.png', './favicon.ico'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  // Ne pas intercepter les requêtes cross-origin (API Google Apps Script, etc.)
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
