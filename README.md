# Čeku skeneris: PWA apvalks (GitHub Pages)

Šī mapa ir neliela statiska lapa, kas padara tavu Apps Script lietotni par **īstu instalējamu PWA** (ikona sākuma ekrānā, pilnekrāna režīms, service worker).
Pati lietotne (Code.gs + Index.html) paliek Apps Script; apvalks to tikai ielādē iframe iekšā.

Kāpēc tas vajadzīgs: Apps Script nevar atdot atsevišķus failus (manifest.json, service worker) un lieto iframe, tāpēc iOS/Android no tās vien
nevar uztaisīt pilnvērtīgu PWA. Apvalks to dara viņas vietā, un papildus saglabā pieteikšanās sesiju savā glabātuvē (Safari mēdz iztīrīt iframe glabātuvi).

## Faili

| Fails | Ko dara |
|---|---|
| `index.html` | apvalka lapa ar iOS meta tagiem (`black-translucent`, nosaukums "Čeku Skeneris") |
| `config.js` | **vienīgais fails, ko vajag rediģēt**: Web App adrese |
| `shell.js`, `shell.css` | iframe ielāde, tilts ar lietotni, instalēšanas poga, "nav interneta" ekrāns |
| `manifest.webmanifest` | īstais PWA manifests (ikonas 192/512 + maskable) |
| `sw.js` | service worker (apvalks atveras arī bez interneta; pati lietotne bez interneta nestrādā) |
| `icons/` | ikonas (180 iOS, 192, 512, maskable 512) |

## Uzstādīšana (apmēram 5 minūtes)

1. **Apps Script:** Deploy → Manage deployments → ✏️ → Version: **New version** → Execute as **Me**, Who has access **Anyone** → Deploy. Nokopē Web app adresi (beidzas ar `/exec`).
2. **GitHub:** izveido jaunu publisku repozitoriju (piem., `ceku-skeneris`) un augšupielādē **visus šīs mapes failus** (arī mapi `icons`) repozitorija saknē.
3. Repozitorijā: Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `/ (root)` → Save. Pēc minūtes lapa būs pieejama adresē `https://TAVS-LIETOTAJVARDS.github.io/ceku-skeneris/`.
4. Atver `config.js` un ieraksti `appsScriptUrl: 'https://script.google.com/macros/s/…/exec'`. (Ja to atstāj tukšu, apvalks pirmajā palaišanā pats palūgs adresi un atcerēsies to tajā ierīcē.)
5. **Apps Script → Project Settings → Script properties:** pievieno `PWA_ORIGIN` = `https://TAVS-LIETOTAJVARDS.github.io` (tikai domēns, **bez** `/ceku-skeneris` un bez gala slīpsvītras). Bez šī tilts ar apvalku ir izslēgts, un lietotne glabā sesiju tikai savā iframe glabātuvē.
6. Draugiem sūti **apvalka adresi** (GitHub Pages), nevis `/exec` adresi.

## Pievienošana sākuma ekrānam

- **iPhone/iPad (Safari):** Share (kvadrāts ar bultiņu uz augšu) → **Add to Home Screen**. Jāatver tieši Safari, nevis citā pārlūkā.
- **Android (Chrome):** trīs punkti augšējā labajā stūrī → **Install app** vai **Add to Home screen**. Ja Chrome piedāvā instalēšanu, lietotnes iekšienē parādīsies arī poga "Instalēt tagad".

## Problēmu risināšana

- **Baltā/tukšā lapa vai Google kļūdas josla augšā:** Google dažkārt rāda brīdinājuma joslu "This application was created by another user…". Ieraksti `config.js` → `cropTop: 40` (pārbaudi, lai augšējā lietotnes josla nepazūd; vajadzības gadījumā samazini).
- **Pēc kodu/failu maiņas vecā versija:** `sw.js` palielini `VERSION` (piem., `'v2'`) un augšupielādē vēlreiz.
- **Sesija "neturas" iOS:** pārbaudi, vai `PWA_ORIGIN` ir pareizs (precīzs domēns, `https`), un ka lietotne tiek atvērta caur apvalka adresi.
- **Bridge nestrādā, ja Google maina savu iekšējo domēnu:** apvalks pieņem ziņas tikai no `script.google.com` un `*-script.googleusercontent.com`. Ja Google to izmaina, lietotne turpina strādāt, tikai sesija glabājas bez apvalka palīdzības.

## Drošība

- Apvalks pieņem ziņas tikai no Apps Script lapām, atbild tikai tai pašai adresei un glabā tikai divas atslēgas (`sesija`, `epasts`), ne vairāk par 2000 simboliem.
- Pats kods (parole) netiek glabāts nekur, tikai sesijas marķieris.
- Apvalka CSP ļauj iegult tikai `script.google.com` un `*.googleusercontent.com`. GitHub Pages neļauj iestatīt `frame-ancestors`, tāpēc kāds cits varētu iegult tavu apvalku savā lapā, taču sesiju viņš nesaņems (ziņas no cita origin tiek ignorētas).
