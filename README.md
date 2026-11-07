# Čeku skeneris: PWA apvalks (GitHub Pages)

Šī mapa ir neliela statiska lapa, kas padara tavu Apps Script lietotni par **īstu instalējamu PWA** (ikona sākuma ekrānā, pilnekrāna režīms, service worker).
Pati lietotne (Code.gs + Index.html) paliek Apps Script; apvalks to tikai ielādē iframe iekšā.

Kāpēc tas vajadzīgs: Apps Script nevar atdot atsevišķus failus (manifest.json, service worker) un lieto iframe, tāpēc iOS/Android no tās vien
nevar uztaisīt pilnvērtīgu PWA. Apvalks to dara viņas vietā, un papildus saglabā pieteikšanās sesiju savā glabātuvē (Safari mēdz iztīrīt iframe glabātuvi).

## Faili

| Fails | Ko dara |
|---|---|
| `index.html` | apvalka lapa ar iOS meta tagiem (`black-translucent`, nosaukums "Čeku Skeneris"), `theme-color` un iPhone ielādes ekrāniem |
| `config.js` | **vienīgais fails, ko vajag rediģēt**: Web App adrese |
| `shell.js`, `shell.css` | iframe ielāde, tilts ar lietotni, instalēšanas poga, "nav interneta" ekrāns |
| `manifest.webmanifest` | īstais PWA manifests (`background_color` un `theme_color` = `#0f172a`, ikonas 192/512 ar `purpose: "any maskable"`) |
| `sw.js` | service worker (apvalks atveras arī bez interneta; pati lietotne bez interneta nestrādā) |
| `icon-180.png`, `icon-192.png`, `icon-512.png` | **obligātās** ikonas (180 iOS, 192 un 512 Android; pilns kvadrāts, mala `#0f172a`, saturs 80 % drošajā zonā) |
| `splash-….png` (13 faili) | **neobligāti**: iPhone ielādes ekrāni; vajadzīgs tikai tas, kas atbilst tavam modelim (skat. tabulu zemāk) |

## Uzstādīšana (apmēram 5 minūtes)

1. **Apps Script:** Deploy → Manage deployments → ✏️ → Version: **New version** → Execute as **Me**, Who has access **Anyone** → Deploy. Nokopē Web app adresi (beidzas ar `/exec`).
2. **GitHub:** izveido jaunu publisku repozitoriju (piem., `ceku-skeneris`). **Mapes nav jāaugšupielādē: visi faili atrodas vienā līmenī, nav neviena apakšmapes.** Repozitorijā: *Add file → Upload files*, atver šīs mapes saturu savā datorā, atzīmē failus (Ctrl+A / Cmd+A; pašu mapi neatzīmē) un velc visus uzreiz uz GitHub lapu. Obligāti vajadzīgi: `index.html`, `shell.js`, `shell.css`, `sw.js`, `config.js`, `manifest.webmanifest`, `icon-180.png`, `icon-192.png`, `icon-512.png`. Ielādes ekrānu (`splash-….png`) var pievienot vēlāk. Ja kāds fails trūkst, lietotne tāpat darbojas (service worker kešo tikai to, kas ir atrasts). Atjauninot failu (piem., `shell.js`), vienkārši augšupielādē to vēlreiz ar tādu pašu nosaukumu un nospied *Commit changes*: GitHub aizstās veco versiju.
3. Repozitorijā: Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `/ (root)` → Save. Pēc minūtes lapa būs pieejama adresē `https://TAVS-LIETOTAJVARDS.github.io/ceku-skeneris/`.
4. Atver `config.js` un ieraksti `appsScriptUrl: 'https://script.google.com/macros/s/…/exec'`. (Ja to atstāj tukšu, apvalks pirmajā palaišanā pats palūgs adresi un atcerēsies to tajā ierīcē.)
5. **Apps Script → Project Settings → Script properties:** pievieno `PWA_ORIGIN` = `https://TAVS-LIETOTAJVARDS.github.io` (tikai domēns, **bez** `/ceku-skeneris` un bez gala slīpsvītras). Bez šī tilts ar apvalku ir izslēgts, un lietotne glabā sesiju tikai savā iframe glabātuvē.
6. Draugiem sūti **apvalka adresi** (GitHub Pages), nevis `/exec` adresi.

## Krāsas, ikona un ielādes ekrāns (bez pelēkām malām)

Visur ir **viena** krāsa, `#0f172a`: `manifest.webmanifest` (`background_color`, `theme_color`), `<meta name="theme-color">`, apvalka fons (`shell.css`) un pati lietotne (`--fons` failā Index.html). Ikonas ir **pilns kvadrāts** (bez caurspīdīgiem stūriem) ar tādu pašu malas krāsu, tāpēc Android ielādes ekrānā un ikonas maskā nekādu malu nav. Ja kādreiz maini krāsu, maini to **visās** minētajās vietās, citādi parādīsies šuve.

- **Android:** ielādes ekrānu veido `background_color` + ikona. Pēc ikonas vai krāsu maiņas lietotne jāizdzēš un jāpievieno no jauna (Chrome manifestu atjauno lēni).
- **iPhone:** iOS manifesta krāsas ignorē; ielādes ekrānu nosaka `apple-touch-startup-image` tagi `index.html` (ierīču izmēri, attēli `splash-….png` repozitorija saknē). Pēc izmaiņām lietotne jāizdzēš no sākuma ekrāna un jāpievieno no jauna, citādi iOS rāda veco (balto) ielādes ekrānu. Ja kāda jauna iPhone modeļa izmērs sarakstā nav vai atbilstošais fails nav augšupielādēts, ielādes ekrāns paliek iOS noklusējuma (īss balts/melns ekrāns) un viss pārējais darbojas tāpat.

**Kurš `splash` fails der kuram iPhone** (augšupielādē tikai savu, vai visus):

| Fails | iPhone |
|---|---|
| `splash-1320x2868.png` | iPhone 16 Pro Max / 17 Pro Max |
| `splash-1260x2736.png` | iPhone Air |
| `splash-1206x2622.png` | iPhone 16 Pro / 17 / 17 Pro |
| `splash-1290x2796.png` | iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus |
| `splash-1179x2556.png` | iPhone 14 Pro / 15 / 15 Pro / 16 |
| `splash-1284x2778.png` | iPhone 12 Pro Max / 13 Pro Max / 14 Plus |
| `splash-1170x2532.png` | iPhone 12 / 12 Pro / 13 / 13 Pro / 14 |
| `splash-1125x2436.png` | iPhone X / XS / 11 Pro / 12 mini / 13 mini |
| `splash-1242x2688.png` | iPhone XS Max / 11 Pro Max |
| `splash-828x1792.png` | iPhone XR / 11 |
| `splash-1242x2208.png` | iPhone 6 Plus / 7 Plus / 8 Plus |
| `splash-750x1334.png` | iPhone SE 2 / SE 3 / 6 / 7 / 8 |
| `splash-640x1136.png` | iPhone SE 1 |

## Pievienošana sākuma ekrānam

- **iPhone/iPad (Safari):** Share (kvadrāts ar bultiņu uz augšu) → **Add to Home Screen**. Jāatver tieši Safari, nevis citā pārlūkā.
- **Android (Chrome):** trīs punkti augšējā labajā stūrī → **Install app** vai **Add to Home screen**. Ja Chrome piedāvā instalēšanu, lietotnes iekšienē parādīsies arī poga "Instalēt tagad".

## Problēmu risināšana

- **Baltā/tukšā lapa vai Google kļūdas josla augšā:** Google dažkārt rāda brīdinājuma joslu "This application was created by another user…". Ieraksti `config.js` → `cropTop: 40` (pārbaudi, lai augšējā lietotnes josla nepazūd; vajadzības gadījumā samazini).
- **Pēc kodu/failu maiņas vecā versija:** `sw.js` palielini `VERSION` (piem., `'v7'`; šobrīd `'v6'`) un augšupielādē vēlreiz.
- **Sesija "neturas" iOS:** pārbaudi, vai `PWA_ORIGIN` ir pareizs (precīzs domēns, `https`), un ka lietotne tiek atvērta caur apvalka adresi.
- **Bridge nestrādā, ja Google maina savu iekšējo domēnu:** apvalks pieņem ziņas tikai no `script.google.com` un `*-script.googleusercontent.com`. Ja Google to izmaina, lietotne turpina strādāt, tikai sesija glabājas bez apvalka palīdzības.

## Drošība

- Apvalks pieņem ziņas tikai no Apps Script lapām, atbild tikai tai pašai adresei un glabā tikai divas atslēgas (`sesija`, `epasts`), ne vairāk par 2000 simboliem.
- Pats kods (parole) netiek glabāts nekur, tikai sesijas marķieris.
- **API atslēga (`SECRET_API_KEY`):** `shell.js` augšpusē ir konstante `SECRET_API_KEY`, un tai jābūt TĀDAI PAŠAI kā `SECRET_API_KEY` failā `Code.gs`. To izmanto tikai JSON ieeja (`doPost`): ja atslēga nesakrīt, serveris atbild `Piekļuve liegta` un neko nedara. Pati lietotne šo ieeju neizmanto (tā strādā caur `google.script.run`), un `shell.js` palīgs `CEKU_API.post('ping')` netiek izsaukts automātiski. Atslēga ir publiskā failā, tāpēc tā NAV patiess noslēpums, bet atsijā gadījuma pieprasījumus. Kad maini atslēgu, nomaini to abos failos un palielini `VERSION` failā `sw.js`.
- **Stabilitāte, ja vienlaikus tiek sūtīti daudzi čeki:** pati lietotne čekus sūta no savas rindas (`Index.html`): ne vairāk kā 3 vienlaikus, ar nelielu atstarpi starp pieprasījumiem; pārejošas kļūdas (tīkls, taimauts, Gemini pārslodze) tiek mēģinātas vēlreiz automātiski (2 reizes), un lietotājs kļūdu redz tikai tad, ja neizdodas arī tad. `shell.js` palīgs `CEKU_API.post` darbojas pēc tā paša principa: `scanReceipt` iet caur rindu (3 vienlaikus, atstarpe 600 ms), bet automātiski tiek atkārtotas tikai drošas darbības (`ping`, `getUser`, `getData`, `getInsight`, `scanReceipt`). `saveReceipt` tiek atkārtots tikai tāpēc, ka katram čekam ir darba ID (serveris pēc tā atpazīst atkārtojumu un čeku tabulā otrreiz neieraksta); citas rakstošās darbības netiek atkārtotas.
- **Darbs fonā un noturība (v5):** katram čekam ir unikāls darba ID, tāpēc pieprasījumu var droši sūtīt vēlreiz (serveris atdod jau gatavo rezultātu, nemaksājot par Gemini vēlreiz, un čeku tabulā neieraksta divreiz). Nesaglabātie čeki (attēls + nolasītie dati) tiek glabāti pārlūka IndexedDB un pēc lietotnes aizvēršanas atjaunojas; ja atbilde nenāk 100 s, pieprasījums tiek nosūtīts vēlreiz; pēc minimizēšanas (≥ 15 s) un tīkla atgriešanās ceļā esošie pieprasījumi tiek atsākti. Apvalks pasaka lietotnei, kad tas tiek paslēpts/atgriezts (`paslepts`/`redzams`), un iframe ir atļauts `screen-wake-lock` (ekrāns nolasīšanas laikā neaptumšojas). **Ierobežojums:** pilnībā aizvērtu vai iOS apturētu lietotni nevar turpināt nolasīt — darbs turpinās, kad tu atgriezies; iOS var arī iztīrīt trešo pušu iframe glabātuvi (retos gadījumos čeku rinda nav atjaunojama).
- Apvalka CSP ļauj iegult tikai `script.google.com` un `*.googleusercontent.com`, un tikai uz šīm adresēm atļauj JSON pieprasījumus (`connect-src`). GitHub Pages neļauj iestatīt `frame-ancestors`, tāpēc kāds cits varētu iegult tavu apvalku savā lapā, taču sesiju viņš nesaņems (ziņas no cita origin tiek ignorētas).
