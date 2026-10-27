/*
 * Service worker: apvalka čaula strādā arī bez interneta (parādās "Nav interneta" ekrāns), un lietotne atveras ātrāk.
 * Apps Script lietotne pati NETIEK kešota: tā ir cita adrese (cits origin), un šis worker to neaiztiek.
 * Stratēģija: tīkls vispirms, kešs kā rezerve (tāpēc izmaiņas failos parādās uzreiz, kad ir internets).
 * Kad maini apvalka failus, palielini VERSION, lai vecais kešs tiktu izmests.
 */
const VERSION = 'v3';
const KESS = 'ceku-apvalks-' + VERSION;
const FAILI = ['./', 'index.html', 'shell.css', 'shell.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(KESS).then(function (k) { return k.addAll(FAILI); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (nosaukumi) { return Promise.all(nosaukumi.filter(function (n) { return n.indexOf('ceku-apvalks-') === 0 && n !== KESS; }).map(function (n) { return caches.delete(n); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  const req = ev.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;      // Apps Script un citi cross-origin pieprasījumi netiek aiztikti
  ev.respondWith(
    fetch(req).then(function (atbilde) {
      if (atbilde && atbilde.ok) { const kopija = atbilde.clone(); caches.open(KESS).then(function (k) { k.put(req, kopija); }); }
      return atbilde;
    }).catch(function () {
      return caches.match(req).then(function (k) { return k || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()); });
    })
  );
});
