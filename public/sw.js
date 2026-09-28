/*
 * KEVLAR offline worker.
 *
 * The export uses content-hashed filenames, so a hardcoded precache list would
 * rot on every build. Instead this caches the shell on install and then caches
 * every same-origin asset the first time it is fetched. One online launch is
 * enough to make the app permanently offline-capable.
 */

/*
 * Bumping this name is what actually forces a refresh: `activate` deletes
 * every cache that is not the current one, so a rename discards the old
 * build wholesale rather than hoping each entry revalidates.
 */
const CACHE = 'kevlar-v5-bric';
const SHELL = './';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SHELL, './manifest.json']))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always resolve to the cached shell so the app opens with no
  // network at all. It is a single-page app; routing happens client-side.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Everything else: serve from cache, fall back to network, cache what comes back.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => hit)
    )
  );
});
