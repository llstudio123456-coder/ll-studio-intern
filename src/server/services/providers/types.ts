import type { ProviderRawResult, SearchProviderName } from '@shared/types'
import type { BrowserManager } from '../browser'

export interface ProviderSearchOpts {
  country?: string
  count?: number
  /** geteilte Browserinstanz für den lokalen Provider */
  bm?: BrowserManager
}

export interface ProviderSearchResult {
  results: ProviderRawResult[]
  blocked: boolean
  error?: string
}

/**
 * Einheitliche Schnittstelle für alle Such-Quellen.
 * API-Provider sind optional und nur aktiv, wenn ein Key gesetzt ist.
 */
export interface SearchProvider {
  name: SearchProviderName
  /** menschlich lesbarer Name für die UI */
  label: string
  /** benötigt dieser Provider einen API-Key? */
  needsKey: boolean
  isConfigured(): boolean
  search(query: string, opts: ProviderSearchOpts): Promise<ProviderSearchResult>
}

export function emptyResult(blocked = false, error?: string): ProviderSearchResult {
  return { results: [], blocked, error }
}
