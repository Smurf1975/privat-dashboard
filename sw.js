// Service worker: gör dashboarden installerbar och ger ett offline-fallback.
// Network-first, aldrig cache-first — dashboarden deployas med git push och
// får inte frysa på en gammal version.
// Externa anrop (Homey-proxy, Open-Meteo, Google, Spotify, OSM-tiles) passerar orörda.
const CACHE = 'command-center-v1';
const SKAL = ['./', './index.html', './support.js', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // en saknad fil ska inte spränga hela installationen
      .then(c => Promise.allSettled(SKAL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(n => Promise.all(n.filter(x => x !== CACHE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(request)
      .then(svar => {
        if (svar.ok) {
          const kopia = svar.clone();
          caches.open(CACHE).then(c => c.put(request, kopia));
        }
        return svar;
      })
      .catch(async () => {
        const traff = await caches.match(request);
        if (traff) return traff;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
