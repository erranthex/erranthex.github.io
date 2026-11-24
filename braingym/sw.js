// Offline-first service worker: precache the app shell, serve cache-first, refresh in background.
const VERSION = 'mentaro-v3';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/core.js', './js/ui.js', './js/matrix.js', './js/science.js', './js/scoring.js', './js/gamify.js', './js/icons.js',
  './data/words-en.txt', './data/words-es.txt', './data/words-it.txt', './data/words-fr.txt', './data/words-de.txt', './data/words-pt.txt', './data/words-zh.txt', './js/i18n.js', './js/difficulty.js', './js/profiles.js', './privacy.html', './terms.html', './legal.css',
  './js/games/echo-grid.js', './js/games/flash-field.js', './js/games/rule-shift.js', './js/games/arrow-storm.js',
  './js/games/grid-recall.js', './js/games/pattern-logic.js', './js/games/number-sense.js', './js/games/mind-palace.js', './js/games/checkup.js',
  './js/games/word-forge.js', './js/games/name-match.js', './js/games/pathfinder.js', './js/games/orbit.js', './js/games/active-break.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
