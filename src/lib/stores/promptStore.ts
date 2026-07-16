import { create } from 'zustand'
import type {
  InspirationReference,
  TargetCompanyBrief,
  PromptPlatform,
  PromptType,
  PromptGenerationResult,
  SavedPrompt
} from '@shared/types'

interface PromptStore {
  inspiration: InspirationReference | null
  target: TargetCompanyBrief
  promptType: PromptType
  platform: PromptPlatform
  analyzeTargetUrl: boolean
  projectId: string

  generating: boolean
  result: PromptGenerationResult | null
  editedPrompt: string
  error: string | null
  saved: boolean

  setInspiration: (ref: InspirationReference) => void
  clearInspiration: () => void
  setTarget: (p: Partial<TargetCompanyBrief>) => void
  setField: (p: Partial<Pick<PromptStore, 'promptType' | 'platform' | 'analyzeTargetUrl' | 'projectId' | 'editedPrompt'>>) => void
  generate: () => Promise<void>
  savePrompt: () => Promise<SavedPrompt | null>
  reset: () => void
}

const emptyTarget: TargetCompanyBrief = {
  companyName: '',
  url: '',
  industry: '',
  location: '',
  services: '',
  targetGroup: '',
  goal: '',
  preferredPages: [],
  notes: '',
  hasLogo: false,
  assetsNote: ''
}

export const usePromptStore = create<PromptStore>((set, get) => ({
  inspiration: null,
  target: { ...emptyTarget },
  promptType: 'full-rebuild',
  platform: 'claude-code',
  analyzeTargetUrl: false,
  projectId: '',

  generating: false,
  result: null,
  editedPrompt: '',
  error: null,
  saved: false,

  setInspiration: (ref) =>
    set((s) => ({
      inspiration: ref,
      // Branche vorbefüllen, wenn das Ziel noch leer ist
      target: { ...s.target, industry: s.target.industry || ref.industry || '' }
    })),
  clearInspiration: () => set({ inspiration: null }),
  setTarget: (p) => set((s) => ({ target: { ...s.target, ...p } })),
  setField: (p) => set(p),

  generate: async () => {
    const { inspiration, target, promptType, platform, analyzeTargetUrl, projectId } = get()
    if (!inspiration) {
      set({ error: 'Bitte zuerst eine Inspirations-Website wählen.' })
      return
    }
    set({ generating: true, error: null, saved: false })
    try {
      const res = await fetch('/api/prompt/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inspiration, target, promptType, platform, analyzeTargetUrl, projectId: projectId || undefined })
      })
      const data = (await res.json()) as { ok: boolean; result?: PromptGenerationResult; error?: string }
      if (data.ok && data.result) set({ result: data.result, editedPrompt: data.result.prompt })
      else set({ error: data.error || 'Generierung fehlgeschlagen.' })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ generating: false })
    }
  },

  savePrompt: async () => {
    const { result, editedPrompt, target, inspiration, promptType, platform, projectId } = get()
    if (!result) return null
    const body = {
      title: `${target.companyName || 'Kundenprojekt'} – ${promptType}`,
      targetCompany: target.companyName || '[Platzhalter]',
      inspirationSource: inspiration?.companyName || inspiration?.url || '—',
      promptType,
      platform,
      promptText: editedPrompt || result.prompt,
      projectId: projectId || undefined,
      summary: result.summary
    }
    const res = await fetch('/api/prompts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json()) as { ok: boolean; prompt: SavedPrompt }
    set({ saved: true })
    return data.prompt
  },

  reset: () => set({ result: null, editedPrompt: '', error: null, saved: false })
}))
