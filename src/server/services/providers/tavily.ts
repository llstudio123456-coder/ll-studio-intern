import type { SearchProvider, ProviderSearchOpts, ProviderSearchResult } from './types'
import { emptyResult } from './types'
import { loadConfig } from '../config'
import { log } from '../../utils/logger'

/** Tavily Search API (optional, TAVILY_API_KEY). */
export const tavilyProvider: SearchProvider = {
  name: 'tavily',
  label: 'Tavily',
  needsKey: true,
  isConfigured: () => !!loadConfig().tavilyApiKey,
  async search(query, opts: ProviderSearchOpts): Promise<ProviderSearchResult> {
    const key = loadConfig().tavilyApiKey
    if (!key) return emptyResult(false, 'kein Key')
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: 'basic',
          max_results: opts.count || 15
        })
      })
      if (!res.ok) return emptyResult(res.status === 429, `Tavily ${res.status}`)
      const data = (await res.json()) as { results?: { url: string; title?: string; content?: string }[] }
      const results = (data.results || []).map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.content,
        provider: 'tavily' as const,
        query
      }))
      return { results, blocked: false }
    } catch (e) {
      log.warn('Tavily-Fehler:', e)
      return emptyResult(false, e instanceof Error ? e.message : String(e))
    }
  }
}
