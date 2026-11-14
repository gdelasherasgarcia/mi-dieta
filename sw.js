// Service worker: la app tiene que abrir SIEMPRE, con o sin cobertura.
//  · al instalarse precarga todos los archivos (lista en archivos.json, la genera construir_publicar.py)
//  · red primero, pero con un límite de espera: si la red tarda más de ESPERA ms (señal mala, «wifi sin internet»)
//    se usa la copia guardada y la red sigue descargando en segundo plano para la próxima vez
const CACHE = 'dieta-v2';
const ESPERA = 3000;
let lentaHasta = 0;   // si la red acaba de agotar el tiempo, el resto de archivos van directos a la copia (si no, cada tanda de módulos esperaría otros 3 s)

async function precargar() {
  const c = await caches.open(CACHE);
  let lista = [];
  try { lista = await (await fetch('archivos.json', { cache: 'no-store' })).json(); } catch (e) {}
  await Promise.all(['./', ...lista].map(u => c.add(new Request(u, { cache: 'no-store' })).catch(() => {})));
}

self.addEventListener('install', e => { e.waitUntil(precargar().catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const red = fetch(r, { cache: 'no-store' }).then(resp => {
      if (resp.ok) c.put(r, resp.clone()).catch(() => {});
      return resp;
    });
    red.catch(() => {});
    e.waitUntil(red.catch(() => {}));
    const copia = async () => (await c.match(r)) || (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' ? await c.match('./') : undefined);
    try {
      const espera = Date.now() < lentaHasta ? 0 : ESPERA;
      const resp = await Promise.race([red, new Promise(res => setTimeout(() => res(null), espera))]);
      if (resp) return resp;
      lentaHasta = Date.now() + 60000;
      return (await copia()) || await red;
    } catch (err) {
      const x = await copia();
      if (x) return x;
      throw err;
    }
  })());
});
