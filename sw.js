// Doldrums — Service Worker
// Strategy: cache-first for the app shell, network-first for weather API calls

const CACHE = 'doldrums-v1';
const SHELL = [
  '/',
  '/doldrums.html',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=IBM+Plex+Mono:wght@300;400;500&family=Spectral:ital,wght@1,300;1,400&display=swap',
];

// Install — cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Weather API / radar tiles → network first, fallback to cache
// - Everything else → cache first, fallback to network
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Always go network-first for live data
  const isLiveData = url.includes('api.open-meteo.com')
    || url.includes('api.rainviewer.com')
    || url.includes('rainviewer.com')
    || url.includes('nominatim.openstreetmap.org')
    || url.includes('geocoding-api.open-meteo.com');

  if(isLiveData) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Cache a copy of successful responses
          if(res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for app shell and static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        if(res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
