/*
 * Čeku skenera PWA apvalks: loģika.
 *
 * Ko šis fails dara:
 *   1. Nolasa Apps Script Web App adresi no config.js (vai no šīs ierīces atmiņas, ja config.js tā ir tukša) un ielādē to iframe.
 *   2. Reģistrē service worker (sw.js), lai apvalks būtu instalējams un atvērtos ātri.
 *   3. Uztur "tiltu" ar lietotni (window.postMessage). Lietotne ir iegulta iframe iekšā, kur Safari mēdz regulāri
 *      iztīrīt glabātuvi, tāpēc sesiju papildus glabā šis apvalks savā pirmās puses localStorage.
 *      Tilts atbild uz: get / set / del (tikai atslēgas "sesija" un "epasts"), hello (statuss), install (Android "Install") un
 *      darbs (lietotne pasaka, vai notiek nolasīšana: tad apvalks tur ekrānu nomodā, Wake Lock).
 *   4. Pasaka lietotnei, kad apvalks tiek paslēpts vai atkal kļūst redzams (op "paslepts" / "redzams"): iframe iekšā pārlūks to ne vienmēr
 *      paziņo, bet pēc minimizēšanas lietotnei jāsūta vēlreiz pieprasījumi, kas varēja pazust. Iframe ir atļauts "screen-wake-lock",
 *      lai nolasīšanas laikā ekrāns neaptumšotos.
 *
 * DROŠĪBA: ziņas tiek pieņemtas TIKAI no Apps Script lapām (script.google.com un *-script.googleusercontent.com),
 * atbildes tiek sūtītas TIKAI uz to pašu adresi, kas ziņu atsūtīja, un glabāt var tikai divas fiksētas atslēgas.
 */
/*
 * API drošības atslēga JSON ieejai (Apps Script doPost). Tai jābūt TĀDAI PAŠAI kā SECRET_API_KEY failā Code.gs.
 * SVARĪGI: šis fails tiek publicēts (GitHub Pages), tāpēc ikviens var to nolasīt. Atslēga atsijā gadījuma un automatizētus
 * pieprasījumus, bet NAV patiess noslēpums; īstā aizsardzība ir pieteikšanās (e-pasts + kods) un sesijas marķieris serverī.
 */
const SECRET_API_KEY = 'Hdj4JWTxY0EgZMFtgirbAnsyPmlfmE8CVyL6XzEG';

(function () {
  'use strict';

  var CFG = window.CEKU_CONFIG || {};
  var PREFIKSS = 'ceku_apvalks_';
  var ATLAUTAS_ATSLEGAS = { sesija: 1, epasts: 1 };
  var MAKS_VERTIBA = 2000;
  var IELADES_LIMITS_MS = 25000;

  // Apps Script adreses forma (parastie un Workspace konti). Viss pārējais tiek noraidīts.
  var URL_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/;
  // No kurienes pieņem ziņas: Apps Script ārējā lapa un tās iekšējais iframe (n-xxxx-script.googleusercontent.com)
  var GOOGLE_ORIGIN_RE = /^https:\/\/(?:script\.google\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/;
  var papildOrigini = Array.isArray(CFG.extraFrameOrigins)
    ? CFG.extraFrameOrigins.filter(function (o) { return typeof o === 'string' && /^https?:\/\/[^/]+$/.test(o); })
    : [];

  function $(id) { return document.getElementById(id); }
  function rakstitDrosi(f) { try { return f(); } catch (e) { return undefined; } }

  // ── Glabātuve (localStorage ar rezerves variantu atmiņā) ──
  var atmina = {};
  var glab = {
    get: function (k) {
      var v = rakstitDrosi(function () { return localStorage.getItem(PREFIKSS + k); });
      return typeof v === 'string' ? v : (atmina[k] || '');
    },
    set: function (k, v) {
      atmina[k] = v;
      rakstitDrosi(function () { localStorage.setItem(PREFIKSS + k, v); });
    },
    del: function (k) {
      delete atmina[k];
      rakstitDrosi(function () { localStorage.removeItem(PREFIKSS + k); });
    }
  };

  // ── Ekrāni ──
  var ekrani = ['ielade', 'uzstadit', 'bezsaistes'];
  function raditEkranu(id) {
    ekrani.forEach(function (e) { $(e).hidden = e !== id; });
  }
  function paslepEkranus() { ekrani.forEach(function (e) { $(e).hidden = true; }); }

  // ── Adrese ──
  function tiritAdresi(txt) {
    var t = String(txt || '').trim().replace(/[?#].*$/, '');
    return URL_RE.test(t) ? t : '';
  }
  function lietotnesAdrese() {
    return tiritAdresi(CFG.appsScriptUrl) || tiritAdresi(glab.get('url'));
  }
  function adreseNoConfig() { return !!tiritAdresi(CFG.appsScriptUrl); }

  // ── Lietotnes ielāde ──
  var kadrs = $('kadrs');
  var ieladeTaimeris = null;

  // Iframe tiek nomainīts pret jaunu elementu (nevis novirzīts uz about:blank, ko CSP neatļauj), tāpēc katrs mēģinājums ir tīra ielāde.
  function jaunsKadrs(url) {
    var n = kadrs.cloneNode(false);
    n.removeAttribute('src');
    if (url) n.setAttribute('src', url);
    n.addEventListener('load', kadraIelade);
    kadrs.parentNode.replaceChild(n, kadrs);
    kadrs = n;
  }
  function kadraIelade() {
    if (!kadrs.getAttribute('src')) return;
    clearTimeout(ieladeTaimeris);
    paslepEkranus();                         // iframe jau ir apakšā; noņem ielādes pārklājumu
  }

  function sakt() {
    var url = lietotnesAdrese();
    if (!url) { raditEkranu('uzstadit'); return; }
    if (navigator.onLine === false) { raditEkranu('bezsaistes'); return; }

    raditEkranu('ielade');
    $('ieladeTeksts').textContent = 'Ielādē lietotni…';
    $('btnPaligs').hidden = true;
    $('btnMainit').hidden = true;
    $('lietotne').hidden = false;

    clearTimeout(ieladeTaimeris);
    ieladeTaimeris = setTimeout(function () {
      $('ieladeTeksts').textContent = 'Lietotne ielādējas ilgi. Pārbaudi savienojumu' + (adreseNoConfig() ? '.' : ' vai lietotnes adresi.');
      $('btnPaligs').hidden = false;
      $('btnMainit').hidden = adreseNoConfig();
    }, IELADES_LIMITS_MS);

    jaunsKadrs(url);
  }

  $('btnPaligs').addEventListener('click', sakt);
  $('btnMegina').addEventListener('click', sakt);
  $('btnMainit').addEventListener('click', function () {
    glab.del('url');
    clearTimeout(ieladeTaimeris);
    $('lietotne').hidden = true;
    jaunsKadrs('');
    raditEkranu('uzstadit');
  });
  window.addEventListener('online', function () { if (!$('bezsaistes').hidden) sakt(); });

  // Pirmās palaišanas veidlapa
  $('formUzst').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var url = tiritAdresi($('adrese').value);
    var kl = $('uzstKluda');
    if (!url) {
      kl.textContent = 'Adresei jābūt formā https://script.google.com/macros/s/…/exec. Ņem to no Apps Script → Deploy → Manage deployments.';
      kl.hidden = false;
      return;
    }
    kl.hidden = true;
    glab.set('url', url);
    sakt();
  });

  // ── Instalēšana un statuss ──
  var instalesIzsaukums = null;              // beforeinstallprompt notikums (tikai Android/Chrome)
  var klients = null;                        // pēdējais kadrs, kas pateicās ("hello"): tam sūta statusa atjauninājumus

  function irStandalone() {
    return navigator.standalone === true ||
      !!rakstitDrosi(function () { return window.matchMedia('(display-mode: standalone)').matches; });
  }
  function statuss() {
    var st = irStandalone();
    return { op: 'pwa', standalone: st, canInstall: !st && !!instalesIzsaukums };
  }
  function sutitKlientam(zin, avots, origin) {
    try { avots.postMessage(Object.assign({ ceku: 1 }, zin), origin); } catch (e) { /* kadrs vairs nav */ }
  }
  function pazinotStatusu() {
    if (klients) sutitKlientam(statuss(), klients.avots, klients.origin);
  }

  // ── Ekrāna Wake Lock ──
  // Kamēr lietotne nolasa čekus (op "darbs"), ekrāns netiek aptumšots, lai pārlūks lapu neapturētu. Augšējā lapā Wake Lock ir atļauts vienmēr,
  // bet iframe iekšā to Google iekšējais kadrs var neatļaut, tāpēc to tur apvalks. Drošības siksna: ja lietotne 10 min neatsaucas, ekrāns tiek atlaists.
  var WL_MAKS_MS = 10 * 60 * 1000;
  var wlSentinel = null, wlAktivs = false, wlPraasa = false, wlTaimeris = null;
  function wlAtlaist() {
    var s = wlSentinel; wlSentinel = null;
    if (s) rakstitDrosi(function () { var p = s.release(); if (p && p.catch) p.catch(function () {}); });
  }
  function wlPieprasit() {
    if (!wlAktivs || wlSentinel || wlPraasa || document.hidden) return;
    if (!(navigator.wakeLock && navigator.wakeLock.request)) return;
    wlPraasa = true;
    try {
      navigator.wakeLock.request('screen').then(function (s) {
        wlPraasa = false;
        if (!wlAktivs || document.hidden) { rakstitDrosi(function () { s.release(); }); return; }
        wlSentinel = s;
        s.addEventListener('release', function () { if (wlSentinel === s) wlSentinel = null; });
      }, function () { wlPraasa = false; });
    } catch (e) { wlPraasa = false; }
  }
  function wlIestatit(aktivs) {
    wlAktivs = aktivs === true;
    clearTimeout(wlTaimeris); wlTaimeris = null;
    if (!wlAktivs) { wlAtlaist(); return; }
    wlTaimeris = setTimeout(function () { wlAktivs = false; wlAtlaist(); }, WL_MAKS_MS);
    wlPieprasit();
  }

  // Redzamība: apvalks (augšējā lapa) zina, kad lietotne tiek minimizēta vai atgriezta; iframe iekšā to ne visi pārlūki paziņo uzticami
  function pazinotRedzamibu(paslepts) {
    if (klients) sutitKlientam({ op: paslepts ? 'paslepts' : 'redzams' }, klients.avots, klients.origin);
  }
  document.addEventListener('visibilitychange', function () { pazinotRedzamibu(document.hidden === true); if (!document.hidden) wlPieprasit(); });
  window.addEventListener('pagehide', function () { pazinotRedzamibu(true); });
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) pazinotRedzamibu(false); });

  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();                     // Chrome mini-josla netiek rādīta; lietotne pati piedāvā pogu
    instalesIzsaukums = ev;
    pazinotStatusu();
  });
  window.addEventListener('appinstalled', function () { instalesIzsaukums = null; pazinotStatusu(); });
  rakstitDrosi(function () {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', pazinotStatusu);
  });

  function instalet() {
    var ev = instalesIzsaukums;
    if (!ev) return;
    instalesIzsaukums = null;                // beforeinstallprompt var izmantot tikai vienreiz
    rakstitDrosi(function () { ev.prompt(); });
    rakstitDrosi(function () { ev.userChoice.then(pazinotStatusu, pazinotStatusu); });
  }

  // ── Tilts ar lietotni ──
  function originDerigs(o) { return GOOGLE_ORIGIN_RE.test(o) || papildOrigini.indexOf(o) >= 0; }

  window.addEventListener('message', function (ev) {
    if (!originDerigs(ev.origin) || !ev.source) return;
    var d = ev.data;
    if (!d || d.ceku !== 1 || typeof d.op !== 'string') return;

    var atbilde = function (zin) { sutitKlientam(zin, ev.source, ev.origin); };
    var atslega = typeof d.key === 'string' && ATLAUTAS_ATSLEGAS.hasOwnProperty(d.key) ? d.key : '';

    if (d.op === 'get' && atslega) {
      atbilde({ op: 'val', key: atslega, value: glab.get(atslega) });
    } else if (d.op === 'set' && atslega) {
      if (typeof d.value === 'string' && d.value.length <= MAKS_VERTIBA) glab.set(atslega, d.value);
    } else if (d.op === 'del' && atslega) {
      glab.del(atslega);
    } else if (d.op === 'hello') {
      klients = { avots: ev.source, origin: ev.origin };
      atbilde(statuss());
    } else if (d.op === 'install') {
      instalet();
    } else if (d.op === 'darbs') {
      wlIestatit(d.aktivs === true);
    }
  });

  // ── JSON ieeja (doPost) ──
  // Pati lietotne ar serveri runā caur google.script.run (tās čeku rinda un automātiskā atkārtošana ir Index.html), tāpēc šī funkcija netiek
  // izsaukta automātiski. Tā ir paredzēta citiem skriptiem:
  //   CEKU_API.post('ping').then(console.log);
  //   CEKU_API.post('getData', [sesija]).then(function (dati) { … });
  // Pieprasījums ir teksts (text/plain), lai pārlūks nesūtītu pirmspārbaudi (Apps Script uz to neatbild). Apiet atslēgu ar apiKey nevar:
  // serveris to pārbauda pirmo un nesakrišanas gadījumā atbild "Piekļuve liegta".
  //
  // STABILITĀTE (ja vienlaikus jānolasa daudz čeku, piemēram, 9):
  //   • RINDA: scanReceipt (dārgais AI izsaukums) nekad netiek sūtīts "visi uzreiz" — vienlaikus ceļā ir ne vairāk kā MAKS_PARALELI
  //     pieprasījumi un starp divu nosūtīšanu ir vismaz ATSTARPE_MS. Pārējie gaida rindā; neviens pieprasījums neapstādina citus.
  //   • AUTOMĀTISKA ATKĀRTOŠANA: pārejošas kļūdas (tīkls, taimauts, ne-JSON atbilde, servera „pārslogota” / „īslaicīgi nav pieejams”)
  //     tiek mēģinātas vēlreiz līdz ATKARTOJUMI reizēm (1 s un 3 s; pēc pārslodzes 5 s un 10 s), pirms kļūda nonāk pie izsaucēja.
  //   • TIKAI DROŠAS DARBĪBAS: atkārto tikai tās, kuras var atkārtot bez blakusefekta: lasīšanu, scanReceipt (neko neraksta) un saveReceipt,
  //     JA čekam ir darba ID (serveris pēc tā atpazīst atkārtojumu un čeku tabulā neieraksta otrreiz). Ja izsaucējs ID nenorāda, apvalks to
  //     pievieno pats (scanReceipt: 5. arguments; saveReceipt: lauks "id" čeka datos), lai atkārtojums vienmēr būtu drošs.
  //     Citas rakstošās darbības (budžeti, kategorijas, iestatījumi u.c.) NETIEK atkārtotas.
  //   • Pastāvīgas kļūdas ("Piekļuve liegta", slikts attēls, nederīgs formāts) netiek atkārtotas — tās neko neuzlabotu.
  var MAKS_PARALELI = 3;
  var ATSTARPE_MS = 600;
  var ATKARTOJUMI = 2;
  var ATKARTOJUMA_PAUZES = [1000, 3000];
  var PARSLOGOTA_PAUZES = [5000, 10000];
  var DROSAS_DARBIBAS = { ping: 1, getUser: 1, getData: 1, getInsight: 1, scanReceipt: 1 };   // drīkst atkārtot
  var DARBA_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;                                                  // tāds pats formāts kā serverī (DARBA_ID_RE)
  var ID_ALFABETS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  function jaunsDarbaId() {
    var b = new Uint8Array(22), s = '', i;
    try { crypto.getRandomValues(b); } catch (e) { for (i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); }
    for (i = 0; i < b.length; i++) s += ID_ALFABETS.charAt(b[i] & 63);
    return s;
  }
  // Atgriež argumentus, kuros ir darba ID (ja izsaucējs to nenorādīja, tiek pievienots jauns), vai tos pašus, ja darbībai ID nav vajadzīgs.
  // Izsaucēja masīvs netiek mainīts.
  function arDarbaId(darbiba, args) {
    var a = Array.isArray(args) ? args.slice() : [];
    if (darbiba === 'scanReceipt') {
      if (typeof a[4] !== 'string' || !DARBA_ID_RE.test(a[4])) { while (a.length < 4) a.push(null); a[4] = jaunsDarbaId(); }
    } else if (darbiba === 'saveReceipt') {
      var c = a[0];
      if (c && typeof c === 'object' && !Array.isArray(c) && (typeof c.id !== 'string' || !DARBA_ID_RE.test(c.id))) { a[0] = Object.assign({}, c, { id: jaunsDarbaId() }); }
    }
    return a;
  }
  // Vai darbību drīkst atkārtot: lasīšana un scanReceipt vienmēr; saveReceipt tikai ar derīgu darba ID
  function drosiAtkartot(darbiba, args) {
    if (irDarbiba(DROSAS_DARBIBAS, darbiba)) return true;
    return darbiba === 'saveReceipt' && Array.isArray(args) && !!args[0] && typeof args[0] === 'object' && typeof args[0].id === 'string' && DARBA_ID_RE.test(args[0].id);
  }
  var RINDAS_DARBIBAS = { scanReceipt: 1 };                                                    // iet caur rindu
  var PARSLOGOTS_RE = /pārslogota|īslaicīgi nav pieejams/i;
  function irDarbiba(saraksts, v) { return Object.prototype.hasOwnProperty.call(saraksts, v); }
  function pauze(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // Viens pieprasījums bez atkārtošanas. Kļūdai tiek piekārtots: pagaidu (vērts atkārtot) un parslogots (gaidīt ilgāk).
  function vienaisPieprasijums(url, darbiba, args) {
    function kluda(zina, pagaidu, parslogots) { var e = new Error(zina); e.pagaidu = pagaidu === true; e.parslogots = parslogots === true; return e; }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ apiKey: SECRET_API_KEY, action: darbiba, args: Array.isArray(args) ? args : [] }),
      credentials: 'omit',
      redirect: 'follow'
    }).catch(function () {
      throw kluda('Nav savienojuma ar serveri.', true);                                           // tīkla kļūda / taimauts
    }).then(function (r) {
      return r.json().catch(function () { throw kluda('Servera atbilde nav derīga.', true); });   // Google kļūdas lapa utml.
    }).then(function (d) {
      if (!d || d.ok !== true) {
        var zina = (d && typeof d.kluda === 'string' && d.kluda) || 'Piekļuve liegta';
        var p = PARSLOGOTS_RE.test(zina);
        throw kluda(zina, p, p);
      }
      return d.res;
    });
  }
  // Vienu reizi + līdz ATKARTOJUMI atkārtojumiem (tikai drošām darbībām un tikai pārejošām kļūdām)
  function arAtkartojumiem(url, darbiba, args) {
    var atkartot = drosiAtkartot(darbiba, args);
    function meginat(n) {
      return vienaisPieprasijums(url, darbiba, args).catch(function (e) {
        if (!atkartot || n >= ATKARTOJUMI || !e || e.pagaidu !== true) throw e;
        return pauze((e.parslogots ? PARSLOGOTA_PAUZES : ATKARTOJUMA_PAUZES)[n]).then(function () { return meginat(n + 1); });
      });
    }
    return meginat(0);
  }

  // Rinda dārgajiem izsaukumiem: ne vairāk kā MAKS_PARALELI vienlaikus un vismaz ATSTARPE_MS starp nosūtīšanām.
  // Atkārtojuma pauze paliek tajā pašā vietā rindā, tāpēc pārslodzes laikā arī jauni pieprasījumi netiek sūtīti ātrāk.
  var rinda = [], lidojuma = 0, pedejaPalaisana = 0, rindasTaimeris = null;
  function rindaPalaist() {
    if (rindasTaimeris) { clearTimeout(rindasTaimeris); rindasTaimeris = null; }
    while (rinda.length && lidojuma < MAKS_PARALELI) {
      var gaidit = pedejaPalaisana + ATSTARPE_MS - Date.now();
      if (gaidit > 0) { rindasTaimeris = setTimeout(rindaPalaist, gaidit + 5); return; }
      lidojuma++; pedejaPalaisana = Date.now();
      rinda.shift()();
    }
  }
  function rindaPievienot(darbs) {
    return new Promise(function (ok, kluda) {
      rinda.push(function () {
        var p; try { p = Promise.resolve(darbs()); } catch (e) { p = Promise.reject(e); }
        p.then(ok, kluda).then(function () { lidojuma--; rindaPalaist(); });
      });
      rindaPalaist();
    });
  }

  function apiPost(darbiba, args) {
    var url = lietotnesAdrese();
    if (!url) return Promise.reject(new Error('Nav norādīta Apps Script adrese.'));
    var vards = String(darbiba);
    var argumenti = arDarbaId(vards, args);        // viens un tas pats ID visiem šī izsaukuma atkārtojumiem
    var darbs = function () { return arAtkartojumiem(url, vards, argumenti); };
    return irDarbiba(RINDAS_DARBIBAS, vards) ? rindaPievienot(darbs) : darbs();
  }
  window.CEKU_API = Object.freeze({ post: apiPost });

  // ── Starts ──
  // Lūdz pārlūku neizmest šīs lapas glabātuvi (sesija u.c.), kad ierīcē trūkst vietas. Tā ir tikai prasība: atbilde var būt noraidoša.
  rakstitDrosi(function () { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); });
  var crop = Number(CFG.cropTop);
  if (isFinite(crop) && crop > 0) document.documentElement.style.setProperty('--crop', Math.min(Math.round(crop), 120) + 'px');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* bez worker apvalks tāpat strādā, tikai nav instalējams */ });
    });
  }

  sakt();
})();
