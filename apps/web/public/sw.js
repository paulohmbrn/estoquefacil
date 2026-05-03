/* Estoque Fácil — Service Worker minimal.
   Estratégia:
   - install: pré-cacheia shell estático (manifest, ícones, fontes).
   - activate: limpa caches antigos.
   - fetch:
     * GET de página HTML        → network-first com fallback /offline (e cache do shell).
     * GET de asset estático      → stale-while-revalidate.
     * Tudo que NÃO é GET         → passa direto (não toca em mutations / Server Actions).
     * Rotas de API/auth/scan     → passa direto (sem cache, sempre online).
*/

const VERSION = 'estoque-v30-preparar-sem-funcs';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/fonts/Glitten-Regular.otf',
  '/fonts/manrope-regular.otf',
  '/fonts/manrope-semibold.otf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Apaga TODOS os caches que não sejam da versão atual
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
      // Notifica clientes pra fazer reload (pega bundle JS/CSS novo)
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'SW_UPDATED', version: VERSION });
      }
    })(),
  );
});

const isApi = (u) =>
  u.pathname.startsWith('/api/') ||
  u.pathname.startsWith('/_next/data') ||
  u.pathname.startsWith('/l/');

const isAsset = (u) =>
  u.pathname.startsWith('/_next/static') ||
  u.pathname.startsWith('/fonts/') ||
  u.pathname.match(/\.(png|svg|jpg|jpeg|webp|woff2?|otf|ttf|css|js)$/);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isApi(url)) return; // network-only, sem cache

  if (isAsset(url)) {
    // Stale-while-revalidate
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetched = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone()).catch(() => undefined);
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      }),
    );
    return;
  }

  // HTML / pages → network-first, fallback cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset=utf-8><title>Estoque Fácil — Offline</title>' +
            '<style>body{font-family:system-ui;background:#efe4c9;color:#0a1a10;padding:40px;text-align:center}' +
            'h1{font-style:italic;font-weight:400}p{color:#5a6659;max-width:46ch;margin:1em auto}</style>' +
            '<h1>Sem conexão</h1><p>Você está offline. Algumas páginas só funcionam online — tente de novo quando a rede voltar.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
        );
      }),
  );
});
