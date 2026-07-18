/* ─────────────────────────  Website-Zustand — Klassifizierung  ───────────────────────── */

/**
 * Unterscheidet, in welchem Zustand die Website eines Unternehmens ist. Der Kernnutzen (§27):
 * „keine Website" (potenziell guter Kunde) klar trennen von „leere/geparkte Website"
 * (meist Zeitverschwendung).
 */
export type WebsiteState =
  | 'keine'            // gar keine Website hinterlegt
  | 'nicht_erreichbar' // Domain/Server antwortet nicht
  | 'geparkt'          // Domain-Parking / zum Verkauf
  | 'coming_soon'      // „Coming soon" / demnächst
  | 'baustelle'        // „under construction" / Baustelle
  | 'wartung'          // Wartungsseite
  | 'fehlerseite'      // faktische Fehlerseite trotz Status 200
  | 'nur_social'       // Weiterleitung zu Facebook/Instagram o. Ä.
  | 'platzhalter'      // Hosting-Standardseite / „Index of /" / leere CMS-Installation
  | 'leer'             // erreichbar, aber praktisch kein verwertbarer Inhalt
  | 'einfach'          // sehr einfache, dünne Seite (aber echter Inhalt)
  | 'schlecht'         // vorhanden, aber schwach/veraltet
  | 'vorhanden'        // funktionierende Website mit Inhalt
  | 'pruefung'         // manuell: Prüfung erforderlich

export const WEBSITE_STATE_LABELS: Record<WebsiteState, string> = {
  keine: 'Keine Website',
  nicht_erreichbar: 'Website nicht erreichbar',
  geparkt: 'Domain geparkt',
  coming_soon: 'Coming-soon-Seite',
  baustelle: 'Baustellenseite',
  wartung: 'Wartungsseite',
  fehlerseite: 'Nur Fehlerseite',
  nur_social: 'Nur Social Media',
  platzhalter: 'Platzhalterseite',
  leer: 'Website leer',
  einfach: 'Sehr einfache Website',
  schlecht: 'Sehr schlechte Website',
  vorhanden: 'Website vorhanden',
  pruefung: 'Prüfung erforderlich'
}

/** Farbton für das Badge. */
export const WEBSITE_STATE_TONE: Record<WebsiteState, 'green' | 'amber' | 'red' | 'gray'> = {
  keine: 'gray',
  nicht_erreichbar: 'red',
  geparkt: 'red',
  coming_soon: 'amber',
  baustelle: 'amber',
  wartung: 'amber',
  fehlerseite: 'red',
  nur_social: 'amber',
  platzhalter: 'red',
  leer: 'red',
  einfach: 'amber',
  schlecht: 'amber',
  vorhanden: 'green',
  pruefung: 'gray'
}

/**
 * Zustände, die für uns „leer/wertlos" sind — die Domain ist zwar erreichbar, aber ohne
 * verwertbaren Inhalt. Für Filter und niedrigere Priorisierung (§14).
 */
export const EMPTY_WEBSITE_STATES: WebsiteState[] = ['leer', 'platzhalter', 'geparkt', 'coming_soon', 'baustelle', 'wartung', 'fehlerseite']

export interface WebsiteStateInput {
  hasWebsite: boolean       // ist überhaupt eine URL hinterlegt?
  reachable: boolean        // hat der Server geantwortet?
  status?: number           // HTTP-Status
  finalUrl?: string         // Ziel nach Weiterleitungen
  originalHost?: string     // ursprüngliche Domain
  title?: string
  text?: string             // GERENDERTER sichtbarer Text (body.innerText) — inkl. JS-Inhalt
  textLen?: number
  h1?: number
  navItems?: number
  imgs?: number
  links?: number
  hasImpressum?: boolean
  hasContactPage?: boolean
}

const PARKING_RE = /(domain (parking|geparkt|zu verkaufen|for sale|kaufen)|diese domain (ist registriert|steht zum verkauf|kann gekauft werden)|parked (domain|free)|sedoparking|this domain (is for sale|may be for sale)|buy this domain|hier entsteht eine neue (internet|homepage|webseite|webpräsenz)|diese domain wurde registriert)/i
const COMING_SOON_RE = /(coming soon|demnächst|in kürze (für sie )?da|wir sind bald|launching soon|bald verfügbar|website (kommt|folgt) (bald|in kürze))/i
const CONSTRUCTION_RE = /(under construction|im aufbau|in bearbeitung|baustelle|diese seite (befindet sich|ist) (noch )?im aufbau|webseite wird (gerade )?(erstellt|überarbeitet))/i
const MAINTENANCE_RE = /(wartungsarbeiten|maintenance mode|wartungsmodus|kurzzeitig nicht verfügbar|vorübergehend nicht (erreichbar|verfügbar))/i
const ERROR_RE = /(404 (not found|nicht gefunden)|seite (nicht gefunden|existiert nicht)|page not found|error 404|403 forbidden|zugriff verweigert)/i
const PLACEHOLDER_RE = /(index of \/|apache2? (ubuntu|debian) default page|welcome to nginx|it works!|test page for the (apache|nginx)|default web page|willkommen bei ihrem (neuen )?webhosting|hosting-standardseite|diese website läuft (mit|auf) wordpress|just another wordpress site|hallo welt!)/i
const SOCIAL_HOSTS = /(facebook\.com|instagram\.com|linktr\.ee|linkedin\.com|business\.site|jimdo|wixsite\.com\/[^/]+$)/i

/**
 * Klassifiziert den Website-Zustand aus den gerenderten Metriken.
 *
 * Reihenfolge ist wichtig: Erst die eindeutigen Sonderfälle (Parking, Coming-soon, Fehlerseite,
 * Social-Weiterleitung), dann die Inhaltsmenge. So wird eine Parkseite nicht fälschlich als
 * „leer" (statt „geparkt") eingestuft.
 *
 * Bewertet den TATSÄCHLICHEN sichtbaren Text (§11), nicht nur HTML-Länge oder Statuscode.
 */
export function classifyWebsiteState(m: WebsiteStateInput): { state: WebsiteState; reason: string } {
  if (!m.hasWebsite) return { state: 'keine', reason: 'Für dieses Unternehmen ist keine Website hinterlegt.' }
  if (!m.reachable) return { state: 'nicht_erreichbar', reason: `Die Website hat nicht geantwortet${m.status ? ` (Status ${m.status})` : ''}.` }

  const text = (m.text || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const visibleLen = m.textLen ?? text.length

  // Weiterleitung auf Social Media / Baukasten-Subdomain
  if (m.finalUrl && m.originalHost) {
    try {
      const finalHost = new URL(m.finalUrl).host
      if (SOCIAL_HOSTS.test(finalHost) && !finalHost.includes(m.originalHost)) {
        return { state: 'nur_social', reason: 'Die Domain leitet auf ein Social-Media- bzw. Baukastenprofil weiter, statt eine eigene Website zu zeigen.' }
      }
    } catch { /* ungültige URL ignorieren */ }
  }

  if (PARKING_RE.test(text)) return { state: 'geparkt', reason: 'Die Domain ist erreichbar, zeigt aber nur eine Parking-/Verkaufsseite ohne Unternehmensinhalt.' }
  if (COMING_SOON_RE.test(text)) return { state: 'coming_soon', reason: 'Es wurde nur eine „Coming soon"-Seite erkannt.' }
  if (MAINTENANCE_RE.test(text)) return { state: 'wartung', reason: 'Es wurde nur eine Wartungsseite erkannt.' }
  if (CONSTRUCTION_RE.test(text) && visibleLen < 800) return { state: 'baustelle', reason: 'Es wurde lediglich eine Baustellen-/Im-Aufbau-Seite erkannt.' }
  if (ERROR_RE.test(text) && visibleLen < 1200) return { state: 'fehlerseite', reason: 'Die Seite zeigt faktisch eine Fehlermeldung (z. B. „Seite nicht gefunden"), obwohl der Server technisch antwortet.' }
  if (PLACEHOLDER_RE.test(text)) return { state: 'platzhalter', reason: 'Es wurde nur eine Standard-/Platzhalterseite des Hosters bzw. eine leere CMS-Installation erkannt.' }

  // Praktisch leer: kaum sichtbarer Text, keine Navigation, keine Überschrift.
  const nav = m.navItems ?? 0
  const h1 = m.h1 ?? 0
  if (visibleLen < 120 && nav < 2 && h1 === 0) {
    return { state: 'leer', reason: 'Die Domain ist erreichbar, enthält aber keinen verwertbaren Website-Inhalt.' }
  }
  if (visibleLen < 350 && nav < 3) {
    return { state: 'leer', reason: 'Die Seite enthält kaum sichtbaren Inhalt und wirkt praktisch leer.' }
  }

  // Sehr einfach, aber echter Inhalt.
  if (visibleLen < 900 && (nav < 4 || h1 === 0)) {
    return { state: 'einfach', reason: 'Eine sehr einfache Seite mit wenig Inhalt und Struktur.' }
  }

  // Vorhanden — die eigentliche Qualitätsbewertung macht der Score separat.
  return { state: 'vorhanden', reason: 'Funktionierende Website mit Inhalt.' }
}

/** Effektiver Zustand: manuelle Korrektur hat Vorrang vor der automatischen Erkennung (§15). */
export function effectiveWebsiteState(auto?: WebsiteState | null, manual?: WebsiteState | null): WebsiteState | null {
  return manual || auto || null
}
