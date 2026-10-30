/*
 * Service worker do Além do Horizonte (gerado no build pelo vite.config.ts).
 *
 * - Na instalação, guarda no cache todos os arquivos do jogo.
 * - Depois disso o jogo abre mesmo sem internet.
 * - A página (index.html) é buscada primeiro na rede, para pegar atualizações;
 *   sem rede, usa a cópia do cache.
 * - Os demais arquivos têm nomes com "hash" (mudam a cada versão), então podem
 *   vir direto do cache.
 */
const VERSION = '__VERSION__';
const CACHE = `alem-do-horizonte-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, self.registration.scope))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('alem-do-horizonte-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(new URL('./', self.registration.scope), copy));
          return response;
        })
        .catch(() => caches.match(new URL('./', self.registration.scope)).then((hit) => hit || caches.match(request))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
