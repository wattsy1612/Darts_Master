/* Generated per build. Only the public app shell is cached, never match data,
   API requests, credentials, external fonts or media. */
const CACHE = __CACHE_NAME__;
const FILES = __PRECACHE_FILES__;
const urls = FILES.map((file) => new URL(file, self.registration.scope).href);
const shell = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(
          urls.map((url) => new Request(url, { cache: 'reload' })),
        );
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
      // Updates wait for all existing clients to close. Never skipWaiting while
      // a match or unsubmitted draft may be open in another tab.
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith('darts-master-shell-') && name !== CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin) return;
  const isShell =
    request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.href.split('?')[0] === shell);
  const target = isShell ? shell : new URL(url.pathname, url.origin).href;
  if (!isShell && !urls.includes(target)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(target)) || fetch(request);
    })(),
  );
});
