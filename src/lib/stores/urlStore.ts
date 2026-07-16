import { create } from 'zustand'
import type {
  RunConfig,
  AnalysisProject,
  ProgressEvent,
  TargetWebsiteAnalysis,
  SearchQuery,
  CompetitorAnalysis
} from '@shared/types'
import { runStream } from '@/lib/client'

interface UrlStore {
  config: RunConfig
  setConfig: (p: Partial<RunConfig>) => void

  running: boolean
  progress: ProgressEvent | null
  error: string | null
  project: AnalysisProject | null
  liveTarget: TargetWebsiteAnalysis | null
  liveQueries: SearchQuery[]
  liveComp: CompetitorAnalysis[]

  start: () => Promise<void>
  reset: () => void
}

const defaultConfig: RunConfig = {
  url: '',
  maxResults: 10,
  country: 'Deutschland',
  region: '',
  radius: '',
  style: '',
  industryOverride: '',
  manualUrls: [],
  manualSearchOnly: false
}

/**
 * Globaler Store für die URL-Analyse. Lebt außerhalb der Seite,
 * damit ein laufender Analyse-Lauf bei Navigation NICHT abbricht.
 */
export const useUrlStore = create<UrlStore>((set, get) => ({
  config: { ...defaultConfig },
  setConfig: (p) => set((s) => ({ config: { ...s.config, ...p } })),

  running: false,
  progress: null,
  error: null,
  project: null,
  liveTarget: null,
  liveQueries: [],
  liveComp: [],

  start: async () => {
    const { config, running } = get()
    if (running) return
    if (!config.url.trim()) {
      set({ error: 'Bitte eine URL eingeben.' })
      return
    }
    set({
      running: true,
      error: null,
      project: null,
      liveTarget: null,
      liveQueries: [],
      liveComp: [],
      progress: { phase: 'init', message: 'Starte …', percent: 0 }
    })
    try {
      const result = await runStream<AnalysisProject>('/api/analyze-url', config, (e) => {
        set((s) => {
          const next: Partial<UrlStore> = { progress: e }
          if (e.partialTarget) next.liveTarget = e.partialTarget
          if (e.partialQueries) next.liveQueries = e.partialQueries
          if (e.partialCompetitor) {
            next.liveComp = [...s.liveComp, e.partialCompetitor].sort((a, b) => b.score.total - a.score.total)
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

  reset: () =>
    set({ project: null, progress: null, error: null, liveTarget: null, liveQueries: [], liveComp: [] })
}))
