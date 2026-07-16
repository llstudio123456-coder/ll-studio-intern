import type { SearchProvider, ProviderSearchOpts, ProviderSearchResult } from './types'
import { emptyResult } from './types'
import { localSearchSingle } from '../searchEngine'
import { log } from '../../utils/logger'

/**
 * Lokaler Browser-Provider (Playwright, ohne API-Key).
 * Standardquelle – funktioniert immer, solange ein Browser läuft.
 */
export const localBrowserProvider: SearchProvider = {
  name: 'local',
  label: 'Lokaler Browser (Startpage/Bing/DDG)',
  needsKey: false,
  isConfigured: () => true,
  async search(query, opts: ProviderSearchOpts): Promise<ProviderSearchResult> {
    if (!opts.bm) return emptyResult(false, 'kein Browser')
    try {
      const { raw, blocked, error } = await localSearchSingle(opts.bm, query)
      return {
        results: raw.map((r) => ({
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          provider: 'local' as const,
          query
        })),
        blocked,
        error
      }
    } catch (e) {
      log.warn('Lokaler Provider-Fehler:', e)
      return emptyResult(false, e instanceof Error ? e.message : String(e))
    }
  }
}
