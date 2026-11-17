// Service worker de HEXCRYPT (generado por tools/build-site.sh): el juego funciona sin conexión.
// Los archivos llevan la versión en la URL, así que se sirven desde la caché; la página y version.json
// se piden primero a la red (para recibir versiones nuevas) y, sin conexión, se usa la copia guardada.
const VERSION = '4a7b16d-202611170814';
const CACHE = 'hexcrypt-' + VERSION;
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "css/style.css?v=4a7b16d-202611170814", "js/util.js?v=4a7b16d-202611170814", "js/font.js?v=4a7b16d-202611170814", "js/art.js?v=4a7b16d-202611170814", "js/assets.js?v=4a7b16d-202611170814", "js/sprites.js?v=4a7b16d-202611170814", "js/audio.js?v=4a7b16d-202611170814", "js/world.js?v=4a7b16d-202611170814", "js/dungeon.js?v=4a7b16d-202611170814", "js/render.js?v=4a7b16d-202611170814", "js/classes.js?v=4a7b16d-202611170814", "js/skills.js?v=4a7b16d-202611170814", "js/vfx.js?v=4a7b16d-202611170814", "js/ambient.js?v=4a7b16d-202611170814", "js/ui.js?v=4a7b16d-202611170814", "js/controls.js?v=4a7b16d-202611170814", "js/enemies.js?v=4a7b16d-202611170814", "js/game.js?v=4a7b16d-202611170814", "js/shop.js?v=4a7b16d-202611170814", "js/items.js?v=4a7b16d-202611170814", "js/elites.js?v=4a7b16d-202611170814", "js/puzzles.js?v=4a7b16d-202611170814", "js/save.js?v=4a7b16d-202611170814", "js/touch.js?v=4a7b16d-202611170814", "js/gamepad.js?v=4a7b16d-202611170814", "js/stats.js?v=4a7b16d-202611170814"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('hexcrypt-') || k.startsWith('cryptfall-')) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url), page = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html'), live = url.pathname.endsWith('version.json');
  if (page || live) { // primero la red; sin conexión, lo guardado
    e.respondWith(fetch(req).then(r => { if (page && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); } return r; })
      .catch(() => caches.match(page ? './' : req, { ignoreSearch: live })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
});
