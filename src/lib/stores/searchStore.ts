import { create } from 'zustand'
import type {
  InspirationSearchConfig,
  InspirationSearchProject,
  ProgressEvent,
  SearchQuery,
  CompetitorAnalysis,
  ManualUrlInput
} from '@shared/types'
import { runStream } from '@/lib/client'

interface SearchStore {
  // Eingaben (bleiben bei Navigation erhalten)
  tab: 'quick' | 'guided'
  query: string
  industry: string
  styles: string[]
  goals: string[]
  features: string[]
  region: string
  maxResults: number
  manualUrls: ManualUrlInput[]
  manualSearchOnly: boolean
  setField: <K extends keyof SearchInputs>(key: K, value: SearchInputs[K]) => void

  // Lauf
  running: boolean
  progress: ProgressEvent | null
  error: string | null
  project: InspirationSearchProject | null
  liveQueries: SearchQuery[]
  liveResults: CompetitorAnalysis[]

  start: (overrideQuery?: string) => Promise<void>
  reset: () => void
}

type SearchInputs = Pick<
  SearchStore,
  'tab' | 'query' | 'industry' | 'styles' | 'goals' | 'features' | 'region' | 'maxResults' | 'manualUrls' | 'manualSearchOnly'
>

function buildConfig(s: SearchStore, overrideQuery?: string): InspirationSearchConfig {
  const regionVal = s.region === 'Deutschland' || s.region === 'Kein Regionsfilter' ? '' : s.region
  const query = overrideQuery !== undefined ? overrideQuery : s.query.trim() || undefined
  return {
    query: query || undefined,
    categories: { industry: s.industry || undefined, styles: s.styles, goals: s.goals, features: s.features, region: regionVal || undefined, country: 'Germany' },
    maxResults: s.maxResults,
    country: 'Germany',
    region: regionVal || undefined,
    manualUrls: s.manualUrls,
    manualSearchOnly: s.manualSearchOnly,
    sort: 'score'
  }
}

/**
 * Globaler Store für die Inspiration-Suche. Lauf + Eingaben überleben
 * Seitenwechsel, damit nichts unterbrochen wird.
 */
export const useSearchStore = create<SearchStore>((set, get) => ({
  tab: 'quick',
  query: '',
  industry: '',
  styles: [],
  goals: [],
  features: [],
  region: 'Deutschland',
  maxResults: 20,
  manualUrls: [],
  manualSearchOnly: false,
  setField: (key, value) => set({ [key]: value } as Partial<SearchStore>),

  running: false,
  progress: null,
  error: null,
  project: null,
  liveQueries: [],
  liveResults: [],

  start: async (overrideQuery) => {
    const s = get()
    if (s.running) return
    if (overrideQuery !== undefined) set({ query: overrideQuery })
    const cfg = buildConfig(get(), overrideQuery)
    if (!cfg.query && !cfg.categories?.industry && !cfg.categories?.styles.length && s.manualUrls.length === 0) {
      set({ error: 'Bitte Suchbegriff eingeben oder Kategorien wählen.' })
      return
    }
    set({
      running: true,
      error: null,
      project: null,
      liveQueries: [],
      liveResults: [],
      progress: { phase: 'init', message: 'Starte …', percent: 0 }
    })
    try {
      const result = await runStream<InspirationSearchProject>('/api/inspiration-search', cfg, (e) => {
        set((st) => {
          const next: Partial<SearchStore> = { progress: e }
          if (e.partialQueries) next.liveQueries = e.partialQueries
          if (e.partialCompetitor) {
            next.liveResults = [...st.liveResults, e.partialCompetitor].sort((a, b) => b.score.total - a.score.total)
          }
          return next
        })
      })
      set({ project: result })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ running: false })
    }
  },

  reset: () => set({ project: null, progress: null, error: null, liveQueries: [], liveResults: [] })
}))
