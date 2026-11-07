// Offline support for the hosted app (https only; see js/app.js).
// Network first, so updates show right away; the cached copy is used when offline.
const CACHE = 'math-quest-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  ...['app', 'effects', 'home', 'parents', 'play', 'problems', 'rewards', 'shop', 'shopscreen', 'speech', 'speedround', 'state', 'storage', 'ui', 'unittest', 'accounts'].map((f) => `js/${f}.js`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit ?? caches.match('index.html'))),
  );
});
