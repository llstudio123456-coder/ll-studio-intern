import type { SearchProvider, ProviderSearchOpts, ProviderSearchResult } from './types'
import { emptyResult } from './types'
import { loadConfig } from '../config'
import { log } from '../../utils/logger'

/** Brave Search API (optional, BRAVE_API_KEY). */
export const braveProvider: SearchProvider = {
  name: 'brave',
  label: 'Brave Search API',
  needsKey: true,
  isConfigured: () => !!loadConfig().braveApiKey,
  async search(query, opts: ProviderSearchOpts): Promise<ProviderSearchResult> {
    const key = loadConfig().braveApiKey
    if (!key) return emptyResult(false, 'kein Key')
    const country = (opts.country || 'de').slice(0, 2).toLowerCase()
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&country=${country}&count=${opts.count || 15}`
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': key }
      })
      if (!res.ok) return emptyResult(res.status === 429 || res.status === 403, `Brave ${res.status}`)
      const data = (await res.json()) as { web?: { results?: { url: string; title?: string; description?: string }[] } }
      const results = (data.web?.results || []).map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.description,
        provider: 'brave' as const,
        query
      }))
      return { results, blocked: false }
    } catch (e) {
      log.warn('Brave-Fehler:', e)
      return emptyResult(false, e instanceof Error ? e.message : String(e))
    }
  }
}
