import type {
  CompetitorCandidate,
  ProviderRunInfo,
  SearchProviderName
} from '@shared/types'
import type { SearchProvider } from './types'
import { braveProvider } from './brave'
import { serpApiProvider } from './serpapi'
import { tavilyProvider } from './tavily'
import { localBrowserProvider } from './localBrowser'
import { loadConfig } from '../config'
import type { BrowserManager } from '../browser'
import { getDomain, isUsefulCandidate } from '../../utils/url'

const ALL: SearchProvider[] = [braveProvider, serpApiProvider, tavilyProvider, localBrowserProvider]

/** Welche Provider sind grundsätzlich verfügbar (Key gesetzt bzw. lokal)? */
export function providerStatus(): { name: SearchProviderName; label: string; configured: boolean; needsKey: boolean }[] {
  return ALL.map((p) => ({ name: p.name, label: p.label, configured: p.isConfigured(), needsKey: p.needsKey }))
}

export function configuredSearchProviders(): SearchProviderName[] {
  return ALL.filter((p) => p.needsKey && p.isConfigured()).map((p) => p.name)
}

/** Liefert die aktive Provider-Reihenfolge je nach Konfiguration. */
function activeProviders(): SearchProvider[] {
  const cfg = loadConfig()
  const pref = (cfg.searchProvider || 'auto').toLowerCase()
  const apis = ALL.filter((p) => p.needsKey && p.isConfigured())

  if (pref !== 'auto' && pref !== 'local') {
    const chosen = ALL.find((p) => p.name === pref && p.isConfigured())
    return chosen ? [chosen, localBrowserProvider] : [...apis, localBrowserProvider]
  }
  if (pref === 'local') return [localBrowserProvider]
  // auto: konfigurierte API-Provider zuerst, lokaler Browser als Fallback
  return [...apis, localBrowserProvider]
}

export interface GatherResult {
  candidates: CompetitorCandidate[]
  runs: ProviderRunInfo[]
  providersUsed: SearchProviderName[]
  anyBlocked: boolean
}

export interface GatherOpts {
  country?: string
  maxCandidates?: number
  excludeDomains?: Set<string>
  bm?: BrowserManager
  onProgress?: (done: number, total: number, found: number) => void
}

/**
 * Führt alle Suchanfragen über die aktiven Provider aus und sammelt eindeutige Kandidaten.
 * Pro Query wird der erste Provider mit Treffern genutzt; sonst der nächste (Fallback-Kette).
 */
export async function gatherCandidates(queries: string[], opts: GatherOpts): Promise<GatherResult> {
  const providers = activeProviders()
  const seen = opts.excludeDomains ?? new Set<string>()
  const candidates: CompetitorCandidate[] = []
  const runs: ProviderRunInfo[] = []
  const usedSet = new Set<SearchProviderName>()
  const max = opts.maxCandidates ?? 40
  let anyBlocked = false
  let done = 0

  for (const query of queries) {
    done++
    if (candidates.length >= max) break

    for (const provider of providers) {
      let res
      try {
        res = await provider.search(query, { country: opts.country, count: 15, bm: opts.bm })
      } catch (e) {
        runs.push({
          provider: provider.name,
          query,
          success: false,
          blocked: false,
          count: 0,
          error: e instanceof Error ? e.message : String(e)
        })
        continue
      }
      if (res.blocked) anyBlocked = true

      const fresh: CompetitorCandidate[] = []
      for (const r of res.results) {
        if (!r.url || !isUsefulCandidate(r.url)) continue
        const domain = getDomain(r.url)
        if (seen.has(domain)) continue
        seen.add(domain)
        fresh.push({
          url: r.url,
          domain,
          title: r.title,
          snippet: r.snippet,
          source: 'search',
          foundVia: `${provider.name}: ${query}`,
          analyzed: false
        })
      }

      runs.push({
        provider: provider.name,
        query,
        success: !res.error && res.results.length > 0,
        blocked: res.blocked,
        count: fresh.length,
        error: res.error
      })
      if (fresh.length > 0) {
        usedSet.add(provider.name)
        candidates.push(...fresh)
        break // dieser Provider hat geliefert -> nächste Query
      }
    }
    opts.onProgress?.(done, queries.length, candidates.length)
  }

  return { candidates: candidates.slice(0, max), runs, providersUsed: [...usedSet], anyBlocked }
}
