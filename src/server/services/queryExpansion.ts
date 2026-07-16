import type { SearchQuery, InspirationCategories } from '@shared/types'
import { detectIndustry } from './industry'

/** DE/EN-Begriffe je Branche (UI-Label oder erkannte Branche → Suchbegriffe). */
const INDUSTRY_TERMS: { match: RegExp; de: string; en: string }[] = [
  { match: /restaurant|gastronom|bistro|pizzeria/i, de: 'Restaurant', en: 'restaurant' },
  { match: /café|cafe|kaffee|bäckerei|konditorei/i, de: 'Café', en: 'cafe' },
  { match: /zahnarzt|zahnmedizin|dentist/i, de: 'Zahnarzt', en: 'dentist' },
  { match: /arzt|praxis|doctor|ärzt|medizin/i, de: 'Arztpraxis', en: 'medical practice' },
  { match: /handwerk|craftsman|tischler|schreiner|zimmer/i, de: 'Handwerker', en: 'craftsman' },
  { match: /elektr|electrician/i, de: 'Elektriker', en: 'electrician' },
  { match: /sanitär|heizung|klempner|plumber|shk/i, de: 'Sanitär Heizung', en: 'plumber' },
  { match: /dach|roofer/i, de: 'Dachdecker', en: 'roofer' },
  { match: /maler|lackier|painter/i, de: 'Maler', en: 'painter' },
  { match: /garten|landschaft|galabau/i, de: 'Garten- & Landschaftsbau', en: 'landscaping' },
  { match: /autohaus|kfz|car dealer|fahrzeug/i, de: 'Autohaus', en: 'car dealership' },
  { match: /friseur|barber|hairdresser|salon/i, de: 'Friseur', en: 'hair salon' },
  { match: /beauty|kosmetik|nagel/i, de: 'Beauty Salon', en: 'beauty salon' },
  { match: /fitness|gym|yoga/i, de: 'Fitnessstudio', en: 'gym' },
  { match: /hotel|pension|übernacht/i, de: 'Hotel', en: 'hotel' },
  { match: /immobilien|makler|real estate/i, de: 'Immobilien', en: 'real estate' },
  { match: /anwalt|kanzlei|recht|lawyer|notar/i, de: 'Rechtsanwalt', en: 'law firm' },
  { match: /agentur|agency|studio/i, de: 'Agentur', en: 'agency' },
  { match: /steuer/i, de: 'Steuerberatung', en: 'tax advisor' }
]

/** Stil DE → EN. */
const STYLE_TERMS: Record<string, string> = {
  ästhetisch: 'aesthetic',
  aesthetisch: 'aesthetic',
  modern: 'modern',
  clean: 'clean',
  premium: 'premium',
  luxuriös: 'luxury',
  luxurioes: 'luxury',
  minimalistisch: 'minimalist',
  elegant: 'elegant',
  dunkel: 'dark',
  hell: 'light',
  warm: 'warm',
  'jung / trendig': 'trendy',
  trendig: 'trendy',
  seriös: 'professional',
  serioes: 'professional',
  handwerklich: 'craftsman',
  hochwertig: 'high-end',
  kreativ: 'creative'
}

function resolveIndustry(text: string): { de?: string; en?: string } {
  for (const t of INDUSTRY_TERMS) if (t.match.test(text)) return { de: t.de, en: t.en }
  return {}
}

function manualSearchUrls(query: string) {
  const q = encodeURIComponent(query)
  return [
    { engine: 'Startpage', url: `https://www.startpage.com/sp/search?query=${q}` },
    { engine: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${q}` },
    { engine: 'Google', url: `https://www.google.com/search?q=${q}` },
    { engine: 'Bing', url: `https://www.bing.com/search?q=${q}` }
  ]
}

export interface ExpansionInput {
  query?: string
  categories?: InspirationCategories
  country?: string
  region?: string
}

export interface Expansion {
  queries: SearchQuery[]
  detected: { industry?: string; styles: string[]; region?: string; language: string }
}

/**
 * Baut aus freiem Text und/oder Kategorien eine Menge guter Suchanfragen
 * (DE + EN + Design-Inspirationsquellen) und erkennt Branche/Stil/Region.
 */
export function expandInspirationQueries(input: ExpansionInput): Expansion {
  const cat = input.categories
  const freeText = (input.query || '').trim()
  const corpus = `${freeText} ${cat?.industry || ''} ${(cat?.styles || []).join(' ')}`

  // Branche
  const ind = cat?.industry ? resolveIndustry(cat.industry) : resolveIndustry(freeText)
  let industryDe = ind.de
  let industryEn = ind.en
  if (!industryDe && freeText) {
    const det = detectIndustry(freeText)
    if (det.confidence > 0) {
      industryDe = det.industry
      const re = resolveIndustry(det.industry)
      industryEn = re.en
    }
  }

  // Stile
  const styleRaw = [...(cat?.styles || [])]
  for (const [de] of Object.entries(STYLE_TERMS)) {
    if (new RegExp(`\\b${de}\\b`, 'i').test(corpus) && !styleRaw.includes(de)) styleRaw.push(de)
  }
  // case-insensitive Dedupe (z. B. „Modern“ + „modern“ → einmal)
  const seenStyle = new Set<string>()
  const styles = styleRaw
    .filter((s) => {
      const k = s.toLowerCase()
      if (seenStyle.has(k)) return false
      seenStyle.add(k)
      return true
    })
    .slice(0, 3)
  const stylesEn = styles.map((s) => STYLE_TERMS[s.toLowerCase()] || s).filter(Boolean)
  const stylesDe = styles

  const region = (cat?.region || input.region || '').trim()
  const country = (cat?.country || input.country || 'Germany').trim()
  const countryEn = /deutschland|germany/i.test(country) ? 'Germany' : country

  const baseDe = industryDe || freeText || 'Unternehmen'
  const baseEn = industryEn || baseDe

  const out: string[] = []
  const push = (q: string) => {
    const c = q.replace(/\s+/g, ' ').trim()
    if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c)
  }

  // 1. Freitext wörtlich
  if (freeText) push(freeText)

  // 2. EN-Kombis mit Stil
  const styleEnStr = stylesEn.slice(0, 2).join(' ')
  const styleDeStr = stylesDe.slice(0, 2).join(' ')
  push(`${styleEnStr} ${baseEn} website ${countryEn}`)
  push(`modern ${baseEn} website design`)
  push(`best ${baseEn} website design`)
  push(`premium ${baseEn} website`)
  push(`${baseEn} web design inspiration`)

  // 3. DE-Kombis
  push(`schöne ${styleDeStr} ${baseDe} Webseite`)
  push(`${baseDe} Website modern ${styleDeStr}`)
  push(`${baseDe} ${stylesDe[0] || 'ästhetisches'} Design`)

  // 4. Regionale Suche
  if (region) {
    push(`${baseDe} Webdesign ${region}`)
    push(`${baseEn} website ${region}`)
  }

  // 5. Design-Inspirationsquellen
  push(`Awwwards ${baseEn} website`)
  push(`Webflow ${baseEn} website`)
  push(`Framer ${baseEn} website`)

  const language = /[äöüß]|deutschland|webseite/i.test(corpus + country) ? 'de' : 'de'

  const queries: SearchQuery[] = out.slice(0, 14).map((q, i) => ({
    id: `iq${i + 1}`,
    query: q,
    rationale: 'Inspiration-Suche',
    manualSearchUrls: manualSearchUrls(q)
  }))

  return {
    queries,
    detected: { industry: industryDe, styles: stylesDe, region: region || undefined, language }
  }
}
