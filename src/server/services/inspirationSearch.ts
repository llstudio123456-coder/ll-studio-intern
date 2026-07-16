import type {
  InspirationSearchConfig,
  InspirationSearchProject,
  CompetitorAnalysis,
  CompetitorCandidate,
  ProgressEvent,
  WebsiteSnapshot,
  InspirationReport,
  SortMode
} from '@shared/types'
import { BrowserManager } from './browser'
import { analyzeWebsite } from './extract'
import { scoreWebsite } from './scorer'
import { expandInspirationQueries } from './queryExpansion'
import { gatherCandidates } from './providers/registry'
import { isAiConfigured, aiComplete } from './ai'
import { saveProject } from './storage'
import { familyOf, familyOfSnapshot, gateSnapshot, preGate, FAMILY_LABEL, type IndustryFamily } from './industryGate'
import { normalizeUrl, getDomain } from '../utils/url'
import { log } from '../utils/logger'

/** Erkennt, ob die Eingabe eine URL ist. */
function asUrl(q?: string): string | null {
  if (!q) return null
  const t = q.trim()
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(t)) return normalizeUrl(t)
  return null
}

const DISCLAIMER = 'Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren.'
type Emit = (e: ProgressEvent) => void

interface Detected {
  industry?: string
  styles: string[]
  region?: string
  language: string
}

/** Relevanz der gefundenen Seite zur Suchabsicht (0..100). */
function relevance(snap: WebsiteSnapshot, detected: Detected, cand: CompetitorCandidate): number {
  let r = 30
  const hay = `${snap.title} ${snap.headings.join(' ')} ${cand.title || ''} ${cand.snippet || ''}`.toLowerCase()
  if (detected.industry && snap.industry && snap.industry.toLowerCase().includes(detected.industry.toLowerCase().split(' ')[0]))
    r += 30
  else if (detected.industry && hay.includes(detected.industry.toLowerCase().split(' ')[0])) r += 18
  for (const s of detected.styles) {
    if (snap.designStyle === s.toLowerCase()) r += 12
    else if (hay.includes(s.toLowerCase())) r += 6
  }
  if (detected.region && (snap.location || '').toLowerCase().includes(detected.region.toLowerCase())) r += 10
  return Math.max(0, Math.min(100, r))
}

function buildNarrative(snap: WebsiteSnapshot, detected: Detected, rel: number) {
  const f = snap.features
  const strong: string[] = []
  if (snap.metrics.largeImageCount && snap.metrics.largeImageCount >= 3) strong.push('Großflächige, hochwertige Bildsprache')
  if (f.gallery) strong.push('Galerie/Referenzen')
  if (f.reviews) strong.push('Sichtbare Bewertungen / Social Proof')
  if (f.onlineBooking) strong.push('Online-Terminbuchung')
  if (snap.designStyle === 'premium' || snap.designStyle === 'elegant' || snap.designStyle === 'minimalistisch')
    strong.push(`Hochwertiger ${snap.designStyle}er Stil`)
  if (snap.pages.find((p) => p.type === 'services')) strong.push('Strukturierte Leistungsseiten')
  if (strong.length === 0) strong.push('Solides, aufgeräumtes Layout')

  const ideas: string[] = []
  if (snap.metrics.largeImageCount && snap.metrics.largeImageCount >= 3) ideas.push('Großformatige Hero-/Bildsprache übernehmen')
  if (f.onlineBooking) ideas.push('Direkte Terminbuchung als CTA')
  if (f.reviews) ideas.push('Bewertungen/Logos als Vertrauensblock')
  if (f.beforeAfter) ideas.push('Vorher-Nachher-Element')
  if (f.gallery) ideas.push('Projekt-/Referenzgalerie')
  ideas.push('Klare visuelle Hierarchie & viel Weißraum')

  const matchBits: string[] = []
  if (detected.industry) matchBits.push(`Branche „${snap.industry || detected.industry}“`)
  if (detected.styles.length) matchBits.push(`Stil ${detected.styles.join('/')}`)
  matchBits.push(`Relevanz ${rel}/100`)

  const colors = snap.colors.slice(0, 3).map((c) => c.hex).join(', ')
  return {
    shortDescription: `${snap.companyName || snap.domain} – ${snap.industry || 'Branche'}. Stil: ${snap.designStyle}. Farben: ${colors || 'n/a'}.`,
    whyMatches: `Passt zur Suche: ${matchBits.join(', ')}.`,
    whyInspiring: `Gutes Vorbild: ${strong.slice(0, 3).join('; ')}.`,
    strongElements: Array.from(new Set(strong)).slice(0, 6),
    ideasToAdopt: Array.from(new Set(ideas)).slice(0, 6),
    doNotCopyWarning:
      'Nur Struktur- und Designprinzipien übernehmen. Texte, Bilder, Logo und Wortlaut sind geschützt – nicht 1:1 kopieren.'
  }
}

let idc = 0
async function analyzeResult(
  bm: BrowserManager,
  cand: CompetitorCandidate,
  detected: Detected,
  styleHint?: string
): Promise<CompetitorAnalysis | null> {
  const snap = await analyzeWebsite(bm, cand.url, { styleHint, takeScreenshots: true })
  if (!snap.reachable) return null
  const score = scoreWebsite(snap, styleHint)
  const rel = relevance(snap, detected, cand)
  const n = buildNarrative(snap, detected, rel)
  return {
    id: `s${++idc}_${snap.domain}`,
    snapshot: snap,
    score,
    queryRelevance: rel,
    ...n,
    source: cand.source,
    foundVia: cand.foundVia
  }
}

function sortResults(list: CompetitorAnalysis[], mode: SortMode = 'score'): CompetitorAnalysis[] {
  const key: Record<SortMode, (c: CompetitorAnalysis) => number> = {
    score: (c) => c.score.total,
    aesthetic: (c) => c.score.breakdown.designQuality,
    modern: (c) => c.score.breakdown.modernity,
    structure: (c) => c.score.breakdown.structure,
    mobile: (c) => c.score.breakdown.mobile,
    inspiration: (c) => c.score.breakdown.inspirationValue,
    relevance: (c) => c.queryRelevance ?? 0
  }
  const f = key[mode] || key.score
  return [...list].sort((a, b) => f(b) - f(a))
}

function topPages(results: CompetitorAnalysis[]): string[] {
  const count = new Map<string, number>()
  const labels: Record<string, string> = {
    services: 'Leistungen (einzeln)', about: 'Über uns', contact: 'Kontakt',
    gallery: 'Galerie / Referenzen', references: 'Kundenstimmen', team: 'Team',
    blog: 'Blog / Ratgeber', pricing: 'Preise / Pakete'
  }
  for (const c of results) for (const t of new Set(c.snapshot.pages.map((p) => p.type))) count.set(t, (count.get(t) || 0) + 1)
  const top = Array.from(count.entries()).filter(([t]) => labels[t]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => labels[t])
  return ['Startseite', ...top]
}

function commonFeatures(results: CompetitorAnalysis[]): string[] {
  const keys: [keyof WebsiteSnapshot['features'], string][] = [
    ['onlineBooking', 'Online-Terminbuchung'], ['contactForm', 'Kontaktformular'],
    ['reviews', 'Bewertungen / Social Proof'], ['gallery', 'Galerie'], ['whatsapp', 'WhatsApp'],
    ['beforeAfter', 'Vorher-Nachher'], ['faq', 'FAQ'], ['phoneClickToCall', 'Klick-zum-Anrufen']
  ]
  const out: string[] = []
  for (const [k, label] of keys) {
    const share = results.filter((c) => c.snapshot.features[k]).length / Math.max(results.length, 1)
    if (share >= 0.35) out.push(`${label} (${Math.round(share * 100)}%)`)
  }
  return out
}

async function buildSearchReport(
  results: CompetitorAnalysis[],
  detected: Detected
): Promise<InspirationReport> {
  const ranked = [...results].sort((a, b) => b.score.total - a.score.total)
  const styleCount = new Map<string, number>()
  for (const c of ranked) styleCount.set(c.snapshot.designStyle, (styleCount.get(c.snapshot.designStyle) || 0) + 1)
  const dominant = Array.from(styleCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || detected.styles[0] || 'modern'

  const bestDesign = ranked.filter((c) => c.score.breakdown.designQuality >= 65).slice(0, 3).map((c) => ({
    id: c.id, domain: c.snapshot.domain,
    reason: `Designqualität ${c.score.breakdown.designQuality}/100, Stil „${c.snapshot.designStyle}“`
  }))
  const bestTrust = [...ranked].sort((a, b) => b.score.breakdown.trustSignals - a.score.breakdown.trustSignals).slice(0, 2).map((c) => ({
    id: c.id, domain: c.snapshot.domain,
    reason: `Inhalt/Vertrauen ${c.score.breakdown.trustSignals}/100: ${c.strongElements[0] || ''}`
  }))

  const learnings = [
    `Dominierende Design-Richtung der Top-Treffer: „${dominant}“.`,
    'Starke Hero-Sektion mit klarer Aussage + großem Bild funktioniert in dieser Branche.',
    commonFeatures(ranked)[0] ? `Häufiges Erfolgsmuster: ${commonFeatures(ranked)[0]}.` : 'Klare, reduzierte Navigation.',
    'Konsistente Bildsprache und 2–3 Akzentfarben statt bunter Mix.'
  ]

  const base: InspirationReport = {
    generatedAt: new Date().toISOString(),
    aiUsed: false,
    recommendedDesignDirection: `Für „${detected.industry || 'die Suche'}“ empfiehlt sich eine „${dominant}“ Richtung${
      detected.styles.length ? ` (${detected.styles.join('/')})` : ''
    }: ruhiges Layout, klare Typografie, große Bilder, viel Weißraum.`,
    mustHavePages: topPages(ranked),
    homepageContent: [
      'Klare Hero-Aussage (Was, für wen, Region)',
      'Leistungen/Angebot als Kacheln',
      'Galerie/Referenzen mit echten Bildern',
      'Vertrauensblock (Bewertungen, Auszeichnungen)',
      'Deutlicher Kontakt-/Buchungs-CTA'
    ],
    recommendedCtas: ['Jetzt anfragen', 'Termin buchen', 'Direkt anrufen'],
    colorAndLayoutIdeas: [
      `Beobachtete Farbwelten: ${ranked.flatMap((c) => c.snapshot.colors.slice(0, 1).map((x) => x.hex)).slice(0, 5).join(', ') || 'neutral/edel'}`,
      'Großzügige Abstände, klare Sektionen, max. 2–3 Akzentfarben',
      'Konsistente, hochwertige Bildsprache'
    ],
    recommendedFeatures: commonFeatures(ranked).length ? commonFeatures(ranked) : ['Kontaktformular', 'Galerie', 'Bewertungen'],
    bestDesignReferences: bestDesign,
    bestForContentOrTrust: bestTrust,
    targetMistakesVsCompetitors: learnings, // im Such-Modus: „Was LL Studio lernen kann“
    disclaimer: DISCLAIMER
  }

  if (isAiConfigured()) {
    try {
      const compact = ranked.slice(0, 8).map((c) => ({ domain: c.snapshot.domain, score: c.score.total, style: c.snapshot.designStyle }))
      const raw = await aiComplete(
        'Du bist Senior-Webdesign-Stratege bei LL Studio. Antworte knapp, Deutsch, nur gültiges JSON.',
        `Suchabsicht: ${JSON.stringify(detected)}\nTop-Treffer: ${JSON.stringify(compact)}\n` +
          'Gib JSON: { recommendedDesignDirection: string, learnings: string[], homepageContent: string[] }',
        700
      )
      if (raw) {
        const j = JSON.parse(raw.replace(/```json|```/g, '').trim())
        return {
          ...base,
          aiUsed: true,
          recommendedDesignDirection: j.recommendedDesignDirection || base.recommendedDesignDirection,
          targetMistakesVsCompetitors: Array.isArray(j.learnings) ? j.learnings : base.targetMistakesVsCompetitors,
          homepageContent: Array.isArray(j.homepageContent) ? j.homepageContent : base.homepageContent
        }
      }
    } catch (e) {
      log.warn('KI-Report (Suche) Fallback:', e)
    }
  }
  return base
}

function makeId(): string {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Vollständiger Inspiration-Such-Lauf. */
export async function runInspirationSearch(config: InspirationSearchConfig, emit: Emit): Promise<InspirationSearchProject> {
  idc = 0
  const bm = new BrowserManager(config.headless ?? true)
  const styleHint = config.categories?.styles?.[0]
  try {
    // Wenn die Eingabe eine URL ist: zuerst analysieren und die Branche bestimmen.
    const inputUrl = asUrl(config.query)
    let detected: Detected
    let queries: ReturnType<typeof expandInspirationQueries>['queries']
    let targetFamily: IndustryFamily = 'other'

    if (inputUrl) {
      emit({ phase: 'target', message: `Analysiere Eingabe-Webseite (${getDomain(inputUrl)}) …`, percent: 6 })
      const snap = await analyzeWebsite(bm, inputUrl, { light: true, takeScreenshots: false })
      targetFamily = familyOfSnapshot(snap)
      const industryName = snap.industry && snap.industry !== 'Unbekannt / allgemein' ? snap.industry : FAMILY_LABEL[targetFamily]
      const exp = expandInspirationQueries({
        categories: {
          industry: industryName,
          styles: snap.designStyle && snap.designStyle !== 'unbekannt' ? [snap.designStyle] : config.categories?.styles || [],
          goals: [],
          features: [],
          country: config.country
        },
        country: config.country,
        region: config.region
      })
      queries = exp.queries
      detected = { ...exp.detected, industry: industryName }
      emit({
        phase: 'queries',
        message: `Branche erkannt: ${FAMILY_LABEL[targetFamily]} · ${queries.length} weltweite Suchanfragen`,
        percent: 12,
        partialQueries: queries
      })
    } else {
      emit({ phase: 'queries', message: 'Erzeuge Suchanfragen …', percent: 6 })
      const exp = expandInspirationQueries({ query: config.query, categories: config.categories, country: config.country, region: config.region })
      queries = exp.queries
      detected = exp.detected
      targetFamily = familyOf(`${detected.industry || ''} ${config.categories?.industry || ''} ${config.query || ''}`)
      emit({ phase: 'queries', message: `${queries.length} Suchanfragen erzeugt.`, percent: 12, partialQueries: queries })
    }
    const rejected: { domain: string; url: string; reason: string; industry?: string }[] = []

    const exclude = new Set<string>()
    let candidates: CompetitorCandidate[] = []
    let providerRuns: InspirationSearchProject['providerRuns'] = []
    let providersUsed: InspirationSearchProject['providersUsed'] = []
    let anyBlocked = false

    if (!config.manualSearchOnly) {
      emit({ phase: 'search', message: 'Durchsuche Quellen …', percent: 16 })
      // Analyse je Seite ist aufwändig → nur ~2× der gewünschten Ergebnisse sammeln.
      const candidateCap = Math.min(30, Math.max((config.maxResults || 20) * 2, 12))
      const g = await gatherCandidates(queries.map((q) => q.query), {
        country: config.country,
        maxCandidates: candidateCap,
        excludeDomains: exclude,
        bm,
        onProgress: (done, total, found) =>
          emit({ phase: 'search', message: `Suche ${done}/${total} – ${found} Treffer`, percent: 16 + Math.round((done / total) * 24) })
      })
      candidates = g.candidates
      providerRuns = g.runs
      providersUsed = g.providersUsed
      anyBlocked = g.anyBlocked
    }

    // Manuelle URLs ergänzen
    for (const m of config.manualUrls || []) {
      const url = normalizeUrl(m.url)
      if (!url) continue
      const domain = getDomain(url)
      if (exclude.has(domain)) continue
      exclude.add(domain)
      candidates.push({ url, domain, source: 'manual', foundVia: 'manuell', snippet: m.note, analyzed: false })
    }

    if (candidates.length === 0) {
      emit({
        phase: 'collect',
        message: anyBlocked
          ? 'Quellen blockiert/keine Treffer. Bitte Suchanfragen manuell öffnen und Links einfügen.'
          : 'Keine Treffer. Bitte manuelle URLs hinzufügen oder API-Key in den Einstellungen setzen.',
        percent: 42
      })
    }

    emit({ phase: 'analyze-competitors', message: `Analysiere ${candidates.length} Webseiten …`, percent: 44 })
    const results: CompetitorAnalysis[] = []
    let i = 0
    for (const cand of candidates) {
      i++
      emit({
        phase: 'analyze-competitors',
        message: `Analysiere ${cand.domain} (${i}/${candidates.length})`,
        percent: 44 + Math.round((i / Math.max(candidates.length, 1)) * 40),
        current: cand.domain
      })
      // Günstige Vorab-Prüfung (Titel/Snippet/Domain) → offensichtlich falsche Branchen früh aussortieren
      const pre = preGate(`${cand.title || ''} ${cand.snippet || ''}`, cand.domain, targetFamily)
      if (!pre.match) {
        rejected.push({ domain: cand.domain, url: cand.url, reason: pre.reason || 'unpassend', industry: FAMILY_LABEL[pre.family] })
        log.info(`✗ ${cand.domain} abgelehnt (vorab): ${pre.reason}`)
        continue
      }
      try {
        const res = await analyzeResult(bm, cand, detected, styleHint)
        if (!res) {
          rejected.push({ domain: cand.domain, url: cand.url, reason: 'nicht erreichbar/blockiert' })
          continue
        }
        // Harte Branchen-Gate nach Analyse
        const gate = gateSnapshot(res.snapshot, targetFamily)
        if (!gate.match) {
          rejected.push({ domain: cand.domain, url: cand.url, reason: gate.reason || 'Branche passt nicht', industry: res.snapshot.industry })
          log.info(`✗ ${cand.domain} abgelehnt: ${gate.reason}`)
          continue
        }
        results.push(res)
        emit({ phase: 'analyze-competitors', message: `✓ ${cand.domain} – Score ${res.score.total}`, percent: 44 + Math.round((i / Math.max(candidates.length, 1)) * 40), partialCompetitor: res })
      } catch (e) {
        log.warn('Treffer übersprungen:', cand.domain, e)
      }
    }

    emit({ phase: 'scoring', message: 'Bewerte & sortiere …', percent: 86 })
    const sorted = sortResults(results, config.sort || 'score')
    const maxResults = Math.min(Math.max(config.maxResults || 20, 1), 20)
    const top = sorted.slice(0, Math.max(maxResults, Math.min(10, sorted.length)))

    const searchWarnings: string[] = []
    if (targetFamily !== 'other' && top.length < 3)
      searchWarnings.push(
        `Es wurden nur wenige wirklich passende ${FAMILY_LABEL[targetFamily]}-Webseiten gefunden. ${rejected.length} unpassende Treffer (falsche Branche/Plattform) wurden bewusst ausgeblendet. Tipp: „Weltweit“-Suche, andere Suchbegriffe oder manuelle URLs.`
      )
    else if (rejected.length > 0)
      searchWarnings.push(`${rejected.length} Treffer wurden wegen falscher Branche/Plattform ausgeblendet (nur passende ${FAMILY_LABEL[targetFamily]}-Webseiten werden gezeigt).`)

    emit({ phase: 'report', message: isAiConfigured() ? 'Erstelle Report (KI) …' : 'Erstelle Report …', percent: 92 })
    const report = await buildSearchReport(top, detected)

    const project: InspirationSearchProject = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      mode: 'search',
      config,
      detected,
      targetFamily,
      targetFamilyLabel: FAMILY_LABEL[targetFamily],
      queries,
      providerRuns,
      results: top,
      rejected,
      searchWarnings,
      report,
      aiUsed: report.aiUsed,
      providersUsed
    }
    saveProject(project)
    emit({ phase: 'done', message: `Fertig: ${top.length} Inspirations-Webseiten.`, percent: 100 })
    return project
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    emit({ phase: 'error', message: `Fehler: ${msg}`, percent: 100 })
    throw e
  } finally {
    await bm.close()
  }
}
