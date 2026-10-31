// Service worker mínimo: red primero, caché como respaldo (la app funciona sin conexión una vez cargada).
const CACHE = 'dieta-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r, { cache: 'no-store' }).then(resp => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(r, copia)).catch(() => {}); }
      return resp;
    }).catch(() => caches.match(r).then(x => x || caches.match('./')))
  );
});
