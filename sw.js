/* ==================================================================
   SHOCK · KIOSK — Service Worker
   ------------------------------------------------------------------
   Existe por dos razones:
   1) Chrome solo ofrece "Instalar app" si hay un SW registrado.
   2) Que el kiosco siga abriendo si se cae el wifi del local.

   Estrategia: NETWORK-FIRST, a propósito.
   La tablet SIEMPRE pide a la red primero, así agarra el último deploy
   de GitHub Pages sin quedar pegada a una versión vieja. El cache es
   solo un colchón para cuando no hay red.

   No intercepta pedidos cross-origin (Google Fonts, el logo de
   Tiendanube): esos los maneja el navegador como siempre.
   ================================================================== */

const CACHE = 'shock-kiosk-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .catch(() => {})              // si algo falla, el SW igual instala
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Solo GET del mismo origen. El resto pasa de largo.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // Guardamos una copia fresca para cuando no haya red.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => {
          if (hit) return hit;
          // Navegación sin red y sin match exacto → servimos el kiosco.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
