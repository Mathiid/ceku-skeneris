/*
 * Čeku skenera PWA apvalks: loģika.
 *
 * Ko šis fails dara:
 *   1. Nolasa Apps Script Web App adresi no config.js (vai no šīs ierīces atmiņas, ja config.js tā ir tukša) un ielādē to iframe.
 *   2. Reģistrē service worker (sw.js), lai apvalks būtu instalējams un atvērtos ātri.
 *   3. Uztur "tiltu" ar lietotni (window.postMessage). Lietotne ir iegulta iframe iekšā, kur Safari mēdz regulāri
 *      iztīrīt glabātuvi, tāpēc sesiju papildus glabā šis apvalks savā pirmās puses localStorage.
 *      Tilts atbild uz: get / set / del (tikai atslēgas "sesija" un "epasts"), hello (statuss) un install (Android "Install").
 *
 * DROŠĪBA: ziņas tiek pieņemtas TIKAI no Apps Script lapām (script.google.com un *-script.googleusercontent.com),
 * atbildes tiek sūtītas TIKAI uz to pašu adresi, kas ziņu atsūtīja, un glabāt var tikai divas fiksētas atslēgas.
 */
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
    }
  });

  // ── Starts ──
  var crop = Number(CFG.cropTop);
  if (isFinite(crop) && crop > 0) document.documentElement.style.setProperty('--crop', Math.min(Math.round(crop), 120) + 'px');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* bez worker apvalks tāpat strādā, tikai nav instalējams */ });
    });
  }

  sakt();
})();
