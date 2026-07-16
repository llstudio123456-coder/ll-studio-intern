import type {
  RunConfig,
  ProgressEvent,
  AnalysisProject,
  CompetitorAnalysis,
  CompetitorCandidate,
  TargetWebsiteAnalysis
} from '@shared/types'
import { BrowserManager } from './browser'
import { analyzeTarget } from './targetAnalyzer'
import { generateQueries } from './queryGenerator'
import { runLocalSearch } from './searchEngine'
import { analyzeCandidate } from './competitorAnalyzer'
import { buildInspirationReport } from './inspiration'
import { isAiConfigured } from './ai'
import { saveProject } from './storage'
import { normalizeUrl, getDomain } from '../utils/url'
import { log } from '../utils/logger'

type Emit = (e: ProgressEvent) => void

function makeId(): string {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Erzeugt Kandidaten aus manuell eingegebenen URLs. */
function manualCandidates(config: RunConfig, exclude: Set<string>): CompetitorCandidate[] {
  const out: CompetitorCandidate[] = []
  for (const m of config.manualUrls || []) {
    const url = normalizeUrl(m.url)
    if (!url) continue
    const domain = getDomain(url)
    if (exclude.has(domain)) continue
    exclude.add(domain)
    out.push({ url, domain, source: 'manual', foundVia: 'manuell', snippet: m.note, analyzed: false })
  }
  return out
}

/**
 * Vollständiger Analyse-Lauf. Wirft nur bei fatalen Fehlern;
 * Teil-Fehler (blockierte Suche, einzelne Seiten) werden toleriert.
 */
export async function runPipeline(config: RunConfig, emit: Emit): Promise<AnalysisProject> {
  const url = normalizeUrl(config.url)
  if (!url) throw new Error('Ungültige URL. Bitte eine gültige Webadresse eingeben.')
  config.url = url

  const bm = new BrowserManager(config.headless ?? true)
  const emitP = (e: Partial<ProgressEvent> & { phase: ProgressEvent['phase']; message: string; percent: number }) =>
    emit(e as ProgressEvent)

  try {
    // 1. Zielseite
    emitP({ phase: 'target', message: 'Analysiere Zielseite …', percent: 5, current: getDomain(url) })
    const target: TargetWebsiteAnalysis = await analyzeTarget(bm, config)
    if (!target.reachable) {
      log.warn('Zielseite nicht erreichbar:', target.error)
    }
    emitP({
      phase: 'target',
      message: target.reachable
        ? `Zielseite analysiert: ${target.companyName || getDomain(url)} (${target.industry || 'Branche unklar'})`
        : 'Zielseite nicht erreichbar – fahre mit eingeschränkten Daten fort.',
      percent: 18,
      partialTarget: target
    })

    // 2. Queries
    emitP({ phase: 'queries', message: 'Erzeuge Suchanfragen …', percent: 22 })
    const queries = generateQueries(target, config)
    emitP({ phase: 'queries', message: `${queries.length} Suchanfragen erzeugt.`, percent: 26, partialQueries: queries })

    // 3. Lokale Suche (sofern nicht manueller Modus)
    const excludeDomains = new Set<string>([getDomain(url)])
    let candidates: CompetitorCandidate[] = []
    let searchResults: Awaited<ReturnType<typeof runLocalSearch>>['results'] = []
    let anyBlocked = false

    if (!config.manualSearchOnly) {
      emitP({ phase: 'search', message: 'Durchsuche das Web über lokalen Browser …', percent: 30 })
      const outcome = await runLocalSearch(bm, queries, url, 40, (done, total, found) => {
        emitP({
          phase: 'search',
          message: `Suche ${done}/${total} – ${found} Kandidaten gefunden`,
          percent: 30 + Math.round((done / total) * 20)
        })
      })
      searchResults = outcome.results
      candidates = outcome.candidates
      anyBlocked = outcome.anyBlocked
      for (const c of candidates) excludeDomains.add(c.domain)
    }

    // 4. Manuelle URLs anhängen
    const manual = manualCandidates(config, excludeDomains)
    candidates = [...candidates, ...manual]

    if (candidates.length === 0) {
      emitP({
        phase: 'collect',
        message: anyBlocked
          ? 'Suchmaschinen blockiert/keine Treffer. Bitte Suchanfragen manuell öffnen und Konkurrenz-URLs einfügen.'
          : 'Keine Kandidaten gefunden. Bitte manuelle Konkurrenz-URLs hinzufügen.',
        percent: 52
      })
    }

    // 5. Kandidaten analysieren & bewerten
    emitP({
      phase: 'analyze-competitors',
      message: `Analysiere ${candidates.length} Webseiten …`,
      percent: 54
    })
    const analyzed: CompetitorAnalysis[] = []
    let idx = 0
    for (const cand of candidates) {
      idx++
      emitP({
        phase: 'analyze-competitors',
        message: `Analysiere ${cand.domain} (${idx}/${candidates.length})`,
        percent: 54 + Math.round((idx / Math.max(candidates.length, 1)) * 32),
        current: cand.domain
      })
      try {
        const result = await analyzeCandidate(bm, cand, target, config)
        // nicht erreichbare/leere Seiten überspringen
        if (result.snapshot.reachable) {
          analyzed.push(result)
          emitP({
            phase: 'analyze-competitors',
            message: `✓ ${cand.domain} – Score ${result.score.total}`,
            percent: 54 + Math.round((idx / Math.max(candidates.length, 1)) * 32),
            partialCompetitor: result
          })
        }
      } catch (e) {
        log.warn('Kandidat übersprungen:', cand.domain, e)
      }
    }

    // 6. Ranking & Top N
    emitP({ phase: 'scoring', message: 'Bewerte und sortiere Ergebnisse …', percent: 88 })
    analyzed.sort((a, b) => b.score.total - a.score.total)
    const maxResults = Math.min(Math.max(config.maxResults || 10, 1), 20)
    const top = analyzed.slice(0, Math.max(maxResults, Math.min(10, analyzed.length)))

    // 7. Inspirations-Report
    emitP({
      phase: 'report',
      message: isAiConfigured() ? 'Erstelle Report (KI-gestützt) …' : 'Erstelle Report (regelbasiert) …',
      percent: 92
    })
    const report = await buildInspirationReport(target, top, config)

    const project: AnalysisProject = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      config,
      target,
      queries,
      searchResults,
      competitors: top,
      report,
      aiUsed: report.aiUsed
    }
    saveProject(project)

    emitP({ phase: 'done', message: `Fertig: ${top.length} Top-Webseiten.`, percent: 100 })
    return project
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    emitP({ phase: 'error', message: `Fehler: ${msg}`, percent: 100 })
    throw e
  } finally {
    await bm.close()
  }
}
