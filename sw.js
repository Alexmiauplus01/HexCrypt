// Service worker de HEXCRYPT (generado por tools/build-site.sh): el juego funciona sin conexión.
// Los archivos llevan la versión en la URL, así que se sirven desde la caché; la página y version.json
// se piden primero a la red (para recibir versiones nuevas) y, sin conexión, se usa la copia guardada.
const VERSION = 'c645600-202611181034';
const CACHE = 'hexcrypt-' + VERSION;
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "css/style.css?v=c645600-202611181034", "js/util.js?v=c645600-202611181034", "js/font.js?v=c645600-202611181034", "js/art.js?v=c645600-202611181034", "js/assets.js?v=c645600-202611181034", "js/sprites.js?v=c645600-202611181034", "js/audio.js?v=c645600-202611181034", "js/world.js?v=c645600-202611181034", "js/dungeon.js?v=c645600-202611181034", "js/render.js?v=c645600-202611181034", "js/classes.js?v=c645600-202611181034", "js/skills.js?v=c645600-202611181034", "js/vfx.js?v=c645600-202611181034", "js/ambient.js?v=c645600-202611181034", "js/ui.js?v=c645600-202611181034", "js/controls.js?v=c645600-202611181034", "js/enemies.js?v=c645600-202611181034", "js/game.js?v=c645600-202611181034", "js/shop.js?v=c645600-202611181034", "js/items.js?v=c645600-202611181034", "js/elites.js?v=c645600-202611181034", "js/puzzles.js?v=c645600-202611181034", "js/labyrinth.js?v=c645600-202611181034", "js/chains.js?v=c645600-202611181034", "js/save.js?v=c645600-202611181034", "js/touch.js?v=c645600-202611181034", "js/gamepad.js?v=c645600-202611181034", "js/stats.js?v=c645600-202611181034"];

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
