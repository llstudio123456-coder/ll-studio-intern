import type { SearchProvider, ProviderSearchOpts, ProviderSearchResult } from './types'
import { emptyResult } from './types'
import { loadConfig } from '../config'
import { log } from '../../utils/logger'

/** SerpAPI (Google-Ergebnisse, optional, SERPAPI_KEY). */
export const serpApiProvider: SearchProvider = {
  name: 'serpapi',
  label: 'SerpAPI (Google)',
  needsKey: true,
  isConfigured: () => !!loadConfig().serpApiKey,
  async search(query, opts: ProviderSearchOpts): Promise<ProviderSearchResult> {
    const key = loadConfig().serpApiKey
    if (!key) return emptyResult(false, 'kein Key')
    const gl = (opts.country || 'de').slice(0, 2).toLowerCase()
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&gl=${gl}&hl=de&num=${opts.count || 15}&api_key=${key}`
    try {
      const res = await fetch(url)
      if (!res.ok) return emptyResult(res.status === 429, `SerpAPI ${res.status}`)
      const data = (await res.json()) as {
        organic_results?: { link: string; title?: string; snippet?: string }[]
        error?: string
      }
      if (data.error) return emptyResult(false, data.error)
      const results = (data.organic_results || []).map((r) => ({
        url: r.link,
        title: r.title,
        snippet: r.snippet,
        provider: 'serpapi' as const,
        query
      }))
      return { results, blocked: false }
    } catch (e) {
      log.warn('SerpAPI-Fehler:', e)
      return emptyResult(false, e instanceof Error ? e.message : String(e))
    }
  }
}
