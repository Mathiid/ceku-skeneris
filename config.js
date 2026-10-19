/*
 * Čeku skenera apvalka iestatījumi. Šis ir vienīgais fails, ko vajag rediģēt.
 *
 *  appsScriptUrl     Tavas Apps Script Web App adrese (Deploy → Manage deployments → Web app URL), kas beidzas ar /exec.
 *                    Ja atstāj tukšu, apvalks pirmajā palaišanā pats palūgs to ievadīt un atcerēsies šajā ierīcē.
 *  cropTop           Pikseļi, par cik iframe tiek pabīdīts uz augšu. Ja Apps Script lapas augšā parādās Google brīdinājuma
 *                    josla ("This application was created by another user…"), ieraksti ~40, lai to paslēptu. Parasti 0.
 *  extraFrameOrigins Papildu adreses, no kurām apvalks pieņem ziņas (tikai izstrādei/testiem; parasti tukšs masīvs).
 */
window.CEKU_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbw3unaAKgFbGFHXy3ABGbftr7N4lGiXiHpEF5IPcXjE2sVDPjCTEDKDLSWzBRPA3WzYhA/exec',
  cropTop: 0,
  extraFrameOrigins: []
};
