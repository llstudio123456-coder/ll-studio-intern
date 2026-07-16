import type { SearchQuery, TargetWebsiteAnalysis, RunConfig } from '@shared/types'

/** URLs zum manuellen Öffnen einer Suche (Fallback, falls Auto-Scrape blockiert). */
function manualUrls(query: string) {
  const q = encodeURIComponent(query)
  return [
    { engine: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${q}` },
    { engine: 'Google', url: `https://www.google.com/search?q=${q}` },
    { engine: 'Bing', url: `https://www.bing.com/search?q=${q}` },
    { engine: 'Startpage', url: `https://www.startpage.com/sp/search?query=${q}` }
  ]
}

let counter = 0
function makeQuery(query: string, rationale: string): SearchQuery {
  return { id: `q${++counter}`, query, rationale, manualSearchUrls: manualUrls(query) }
}

/**
 * Generiert Suchanfragen aus der Zielanalyse + Nutzer-Konfiguration.
 * Bewusst ohne Search-API – die Queries werden lokal im Browser ausgeführt
 * oder vom Nutzer manuell geöffnet.
 */
export function generateQueries(
  target: TargetWebsiteAnalysis,
  config: RunConfig
): SearchQuery[] {
  counter = 0
  const industry = config.industryOverride || target.industry || 'Unternehmen'
  const city = config.region || target.location?.replace(/\d{5}/, '').trim() || ''
  const region = config.country || 'Deutschland'
  const style = config.style || 'modern'
  const services = target.services.slice(0, 2)

  const queries: SearchQuery[] = []
  const push = (q: string, r: string) => {
    const clean = q.replace(/\s+/g, ' ').trim()
    if (clean && !queries.find((x) => x.query.toLowerCase() === clean.toLowerCase())) {
      queries.push(makeQuery(clean, r))
    }
  }

  if (city) push(`${industry} ${city}`, 'Lokale Mitbewerber in der Region')
  for (const s of services) {
    if (city) push(`${s} ${city}`, `Anbieter für „${s}“ vor Ort`)
    push(`${s} ${region}`, `Dienstleistung „${s}“ überregional`)
  }
  push(`beste ${industry} Webseite ${region}`, 'Qualitativ hochwertige Referenz-Webseiten')
  push(`${industry} ${style} Webdesign`, 'Optisch starke, stilpassende Webseiten')
  push(`${industry} Referenzen`, 'Anbieter mit Referenz-/Projektseiten')
  push(`${industry} Premium Anbieter`, 'Hochwertige/Premium-Positionierung')
  if (services[0] && city) push(`${industry} ${services[0]} ${city}`, 'Kombinierte lokale Fachsuche')
  push(`${industry} modernes Webdesign Beispiel`, 'Moderne Design-Vorbilder der Branche')

  return queries
}
