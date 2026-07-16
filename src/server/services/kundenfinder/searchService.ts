import { randomUUID } from 'crypto'
import type { Company, LeadCandidate, SearchParams } from '@shared/kundenfinder'
import { BrowserManager } from '../browser'
import { searchOsm } from './leadProviders/osm'
import { upsertCandidate, createRun, addRunResult, finishRun, saveWebsiteAnalysis, setLeadScore, getCompany, qualifyCompany } from './companiesRepo'
import { analyzeWebsite } from './websiteAnalyzer'
import { computeLeadScore } from './leadScore'
import { log } from '../../utils/logger'

const MAX_ANALYZE = 15 // Website-Analysen pro Suchlauf (Zeit/Ressourcen begrenzen)

export interface SearchSummary {
  runId: string
  area: string
  found: number
  neu: number
  duplicates: number
  excluded: number
  possible: number
  analyzed: number
  errors: string[]
  companies: Company[] // die NEU gefundenen (bereits vorhandene werden nicht erneut vorgeschlagen)
}

function passesFilters(c: LeadCandidate, p: SearchParams): boolean {
  const hasWeb = !!(c.website && c.website.trim())
  if (p.onlyWithoutWebsite && hasWeb) return false
  if (p.onlyWithWebsite && !hasWeb) return false
  if (p.onlyWithPhone && !(c.phone && c.phone.trim())) return false
  if (p.onlyWithEmail && !(c.email && c.email.trim())) return false
  return true
}

/** Analysiert Website (falls vorhanden) + berechnet Lead-Score und speichert beides. */
async function enrichCompany(bm: BrowserManager | null, companyId: string, doAnalyze: boolean) {
  const c = getCompany(companyId)
  if (!c) return
  let wa
  if (doAnalyze && bm) {
    wa = await analyzeWebsite(bm, c.website)
    if (wa.score >= 0) saveWebsiteAnalysis(companyId, wa)
  }
  const ls = computeLeadScore({ website: c.website, phone: c.phone, email: c.email, contactName: c.contactName, industry: c.industry }, wa)
  setLeadScore(companyId, ls.score, ls.label, ls.reasons)
  // Kontaktvollständigkeit + Akquise-Priorität + KI-Notiz berechnen (respektiert manuell bearbeitete Notiz)
  qualifyCompany(companyId)
}

/**
 * Führt einen Suchlauf aus: OSM-Suche → Dubletten-Schutz → (optional) Website-Analyse → Lead-Score.
 * Bereits bekannte Unternehmen (gespeichert/kontaktiert/abgelehnt/ausgeschlossen) werden NIE erneut
 * als neuer Lead vorgeschlagen – sie zählen nur als Dublette.
 */
export async function runSearch(params: SearchParams): Promise<SearchSummary> {
  const runId = randomUUID()
  const area = [params.city, params.plz, params.region].filter(Boolean).join(' ') || params.plz || params.city || params.region || ''
  createRun(runId, params as unknown as Record<string, unknown>, area, params.industry, 'osm')

  const errors: string[] = []
  const res = await searchOsm({ area, industry: params.industry, keyword: params.keyword, radiusKm: params.radiusKm, limit: params.maxResults })
  if (res.error) errors.push(res.error)

  let neu = 0
  let duplicates = 0
  let excluded = 0
  let possible = 0
  const newIds: string[] = []

  for (const cand of res.candidates) {
    if (!passesFilters(cand, params)) continue
    try {
      const up = upsertCandidate(cand, { status: 'neu' })
      if (up.isNew) {
        neu++
        if (up.dupStatus === 'possible') possible++
        newIds.push(up.companyId)
      } else {
        duplicates++
        if (up.excluded) excluded++
      }
      addRunResult(runId, up.companyId, up.isNew, up.dupStatus)
    } catch (e) {
      errors.push('Kandidat übersprungen: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Anreicherung (Website-Analyse + Lead-Score) für die neuen Unternehmen
  const doAnalyze = params.analyzeWebsites !== false
  let analyzed = 0
  let bm: BrowserManager | null = null
  try {
    if (doAnalyze) bm = new BrowserManager(true)
    for (const id of newIds) {
      const analyzeThis = doAnalyze && analyzed < MAX_ANALYZE
      await enrichCompany(bm, id, analyzeThis)
      if (analyzeThis) analyzed++
    }
  } catch (e) {
    errors.push('Anreicherung teilweise fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    try {
      await bm?.close()
    } catch {}
  }

  finishRun(runId, { found: res.candidates.length, neu, duplicates, excluded, saved: 0, errors }, errors.length && !neu ? 'fehler' : 'fertig')
  const companies = newIds.map((id) => getCompany(id)).filter((c): c is Company => !!c)
  log.info(`Suchlauf ${runId}: found=${res.candidates.length} neu=${neu} dubletten=${duplicates} (davon ausgeschlossen=${excluded}) analysiert=${analyzed}`)
  return { runId, area: res.area, found: res.candidates.length, neu, duplicates, excluded, possible, analyzed, errors, companies }
}

/** Import einer Kandidatenliste (CSV/manuell) MIT vollem Dubletten-Schutz. */
export function importCandidates(cands: LeadCandidate[]): { neu: number; duplicates: number; possible: number; ids: string[]; details: { name: string; dupStatus: string; companyId: string }[] } {
  let neu = 0
  let duplicates = 0
  let possible = 0
  const ids: string[] = []
  const details: { name: string; dupStatus: string; companyId: string }[] = []
  for (const c of cands) {
    if (!c.name || !c.name.trim()) continue
    const up = upsertCandidate({ ...c, source: c.source || 'import' })
    if (up.isNew) { neu++; ids.push(up.companyId); qualifyCompany(up.companyId); if (up.dupStatus === 'possible') possible++ }
    else duplicates++
    details.push({ name: c.name, dupStatus: up.dupStatus, companyId: up.companyId })
  }
  return { neu, duplicates, possible, ids, details }
}
