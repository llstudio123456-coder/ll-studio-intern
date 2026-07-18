/**
 * Tests für die Website-Zustands-Klassifizierung (Kundenfinder §9–15, Testfälle §25).
 * Spiegelt classifyWebsiteState() aus @shared/websiteState.
 *
 * Aufruf: npm run test:website-state
 */
let pass = 0, fail = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }

const PARKING_RE = /(domain (parking|geparkt|zu verkaufen|for sale|kaufen)|diese domain (ist registriert|steht zum verkauf|kann gekauft werden)|parked (domain|free)|sedoparking|this domain (is for sale|may be for sale)|buy this domain|hier entsteht eine neue (internet|homepage|webseite|webpräsenz)|diese domain wurde registriert)/i
const COMING_SOON_RE = /(coming soon|demnächst|in kürze (für sie )?da|wir sind bald|launching soon|bald verfügbar|website (kommt|folgt) (bald|in kürze))/i
const CONSTRUCTION_RE = /(under construction|im aufbau|in bearbeitung|baustelle|diese seite (befindet sich|ist) (noch )?im aufbau|webseite wird (gerade )?(erstellt|überarbeitet))/i
const MAINTENANCE_RE = /(wartungsarbeiten|maintenance mode|wartungsmodus|kurzzeitig nicht verfügbar|vorübergehend nicht (erreichbar|verfügbar))/i
const ERROR_RE = /(404 (not found|nicht gefunden)|seite (nicht gefunden|existiert nicht)|page not found|error 404|403 forbidden|zugriff verweigert)/i
const PLACEHOLDER_RE = /(index of \/|apache2? (ubuntu|debian) default page|welcome to nginx|it works!|test page for the (apache|nginx)|default web page|willkommen bei ihrem (neuen )?webhosting|hosting-standardseite|diese website läuft (mit|auf) wordpress|just another wordpress site|hallo welt!)/i
const SOCIAL_HOSTS = /(facebook\.com|instagram\.com|linktr\.ee|linkedin\.com|business\.site|jimdo|wixsite\.com\/[^/]+$)/i

function classify(m) {
  if (!m.hasWebsite) return { state: 'keine' }
  if (!m.reachable) return { state: 'nicht_erreichbar' }
  const text = (m.text || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const visibleLen = m.textLen ?? text.length
  if (m.finalUrl && m.originalHost) {
    try {
      const finalHost = new URL(m.finalUrl).host
      if (SOCIAL_HOSTS.test(finalHost) && !finalHost.includes(m.originalHost)) return { state: 'nur_social' }
    } catch { /* */ }
  }
  if (PARKING_RE.test(text)) return { state: 'geparkt' }
  if (COMING_SOON_RE.test(text)) return { state: 'coming_soon' }
  if (MAINTENANCE_RE.test(text)) return { state: 'wartung' }
  if (CONSTRUCTION_RE.test(text) && visibleLen < 800) return { state: 'baustelle' }
  if (ERROR_RE.test(text) && visibleLen < 1200) return { state: 'fehlerseite' }
  if (PLACEHOLDER_RE.test(text)) return { state: 'platzhalter' }
  const nav = m.navItems ?? 0, h1 = m.h1 ?? 0
  if (visibleLen < 120 && nav < 2 && h1 === 0) return { state: 'leer' }
  if (visibleLen < 350 && nav < 3) return { state: 'leer' }
  if (visibleLen < 900 && (nav < 4 || h1 === 0)) return { state: 'einfach' }
  return { state: 'vorhanden' }
}

const base = { hasWebsite: true, reachable: true, navItems: 6, h1: 2, textLen: 3000, text: 'Herzlich willkommen bei der Musterfirma GmbH. Wir bieten Ihnen …' }

console.log('\n── §25: Website-Zustände ──')
ok('Normale Website → vorhanden', classify(base).state === 'vorhanden')
ok('Keine Website → keine', classify({ ...base, hasWebsite: false }).state === 'keine')
ok('Nicht erreichbar → nicht_erreichbar', classify({ ...base, reachable: false }).state === 'nicht_erreichbar')
ok('Leere HTML-Seite → leer', classify({ hasWebsite: true, reachable: true, text: '', textLen: 0, navItems: 0, h1: 0 }).state === 'leer')
ok('Weiße Seite (kaum Text) → leer', classify({ hasWebsite: true, reachable: true, text: '   ', textLen: 3, navItems: 0, h1: 0 }).state === 'leer')
ok('Domain-Parking → geparkt', classify({ hasWebsite: true, reachable: true, text: 'Diese Domain steht zum Verkauf. Buy this domain now.', textLen: 60, navItems: 0, h1: 0 }).state === 'geparkt')
ok('Hier entsteht eine neue Homepage → geparkt', classify({ hasWebsite: true, reachable: true, text: 'Hier entsteht eine neue Homepage.', textLen: 40, navItems: 0, h1: 0 }).state === 'geparkt')
ok('Coming soon → coming_soon', classify({ hasWebsite: true, reachable: true, text: 'Coming soon – demnächst für Sie da!', textLen: 40, navItems: 0, h1: 1 }).state === 'coming_soon')
ok('Baustellenseite → baustelle', classify({ hasWebsite: true, reachable: true, text: 'Diese Seite befindet sich noch im Aufbau.', textLen: 45, navItems: 1, h1: 0 }).state === 'baustelle')
ok('Wartungsseite → wartung', classify({ hasWebsite: true, reachable: true, text: 'Wegen Wartungsarbeiten kurzzeitig nicht verfügbar.', textLen: 55, navItems: 0, h1: 0 }).state === 'wartung')
ok('Hosting-Standardseite → platzhalter', classify({ hasWebsite: true, reachable: true, text: 'Apache2 Ubuntu Default Page — It works!', textLen: 60, navItems: 0, h1: 1 }).state === 'platzhalter')
ok('Leere WordPress-Installation → platzhalter', classify({ hasWebsite: true, reachable: true, text: 'Just another WordPress site. Hallo Welt!', textLen: 60, navItems: 2, h1: 1 }).state === 'platzhalter')
ok('404 trotz Status 200 → fehlerseite', classify({ hasWebsite: true, reachable: true, status: 200, text: 'Error 404 – Seite nicht gefunden.', textLen: 40, navItems: 1, h1: 0 }).state === 'fehlerseite')
ok('Weiterleitung zu Facebook → nur_social', classify({ hasWebsite: true, reachable: true, originalHost: 'firma.de', finalUrl: 'https://www.facebook.com/firmaseite', text: 'facebook', textLen: 500, navItems: 5, h1: 1 }).state === 'nur_social')
ok('Nur Cookie-Banner (wenig Text) → leer', classify({ hasWebsite: true, reachable: true, text: 'Diese Website verwendet Cookies. Akzeptieren Ablehnen', textLen: 60, navItems: 1, h1: 0 }).state === 'leer')

console.log('\n── Abgrenzung „keine" vs. „leer" (§27, besonders wichtig) ──')
ok('Ohne Website ist NICHT „leer"', classify({ hasWebsite: false }).state === 'keine')
ok('Leere Domain ist NICHT „keine"', classify({ hasWebsite: true, reachable: true, text: '', textLen: 0, navItems: 0, h1: 0 }).state === 'leer')
ok('Beide sind verschiedene Zustände', classify({ hasWebsite: false }).state !== classify({ hasWebsite: true, reachable: true, textLen: 0, navItems: 0, h1: 0 }).state)

console.log('\n── Echte Inhalte werden NICHT fälschlich als leer erkannt ──')
ok('Reiche Seite → vorhanden', classify(base).state === 'vorhanden')
ok('JS-gerenderte Seite mit viel Text → vorhanden', classify({ hasWebsite: true, reachable: true, text: 'x'.repeat(5000), textLen: 5000, navItems: 8, h1: 3 }).state === 'vorhanden')
ok('Einfache aber echte Seite → einfach', classify({ hasWebsite: true, reachable: true, text: 'Malerbetrieb Schmidt. Telefon 0221 12345. Wir streichen Ihr Haus.', textLen: 500, navItems: 2, h1: 1 }).state === 'einfach')

console.log(`\n════ Website-Zustand: ${pass}/${pass + fail} bestanden ════`)
process.exit(fail ? 1 : 0)
