const CACHE_NAME = 'shanzone-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './speedtest.js',
  './data.js',
  './logo.jpg',
  './hero-bg.jpg',
  './photo2.jpg',
  './photo3.jpg',
  './favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    })
  );
});
