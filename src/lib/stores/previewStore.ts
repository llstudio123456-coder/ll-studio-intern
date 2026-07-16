import { create } from 'zustand'
import type {
  SourceCompany,
  InspirationReference,
  DesignPreviewResult,
  TargetWebsiteAnalysis,
  CompetitorAnalysis,
  StyleControls
} from '@shared/types'
import { refFromCompetitor } from '@/lib/promptRef'
import { extractLogoColors } from '@/lib/logoColors'

export type PreviewMode = 'desktop' | 'mobile' | 'before-after' | 'reference'

interface PreviewStore {
  source: SourceCompany
  inspiration: InspirationReference | null
  analyzeSourceUrl: boolean
  projectId: string
  controls: StyleControls

  result: DesignPreviewResult | null
  mode: PreviewMode
  generating: boolean
  error: string | null
  seed: number
  saved: boolean
  editing: boolean
  prevSignature: string | null
  prevInspirationKey: string | null
  uniquenessWarning: string | null
  /** gecachte Live-Blueprint der Referenz B */
  blueprint: import('@shared/types').ReferenceBlueprint | null

  newComposition: () => void
  forceStyle: () => void
  freshLayout: () => void
  /** Referenz B komplett neu einlesen und Blueprint neu bauen */
  reanalyzeReference: () => void
  /** Kundenfarben sofort erzwingen (Layout bleibt, nur Palette remappt) */
  enforceCustomerColors: () => void
  setSource: (p: Partial<SourceCompany>) => void
  setServices: (csv: string) => void
  setLogo: (dataUrl: string | undefined) => void
  reextractLogoColors: () => void
  applyVariant: (concept: import('@shared/types').GeneratedHomepageConcept, scores: import('@shared/types').PresentationQuality) => void
  toggleDetectedColor: (hex: string) => void
  setColorMode: (mode: import('@shared/types').PaletteApplicationMode) => void
  lockPalette: (lock: boolean) => void
  reDetectColors: () => void
  savePalette: () => Promise<void>
  setInspiration: (ref: InspirationReference) => void
  setInspirationFromCompetitor: (c: CompetitorAnalysis) => void
  setSourceFromTarget: (t: TargetWebsiteAnalysis) => void
  setField: (p: Partial<Pick<PreviewStore, 'mode' | 'analyzeSourceUrl' | 'projectId'>>) => void
  setEditing: (v: boolean) => void
  updateConceptText: (path: string, value: string) => void
  /** Stil-Regler anpassen und (falls bereits generiert) neu generieren. */
  applyControl: (patch: Partial<StyleControls>) => void
  generate: () => Promise<void>
  regenerate: () => Promise<void>
  reset: () => void
}

const defaultControls: StyleControls = { referenceStrength: 0.8 }

const emptySource: SourceCompany = {
  name: '',
  url: '',
  industry: '',
  location: '',
  services: [],
  targetGroup: '',
  brandFeeling: '',
  colors: [],
  logoDataUrl: undefined
}

export const usePreviewStore = create<PreviewStore>((set, get) => ({
  source: { ...emptySource },
  inspiration: null,
  analyzeSourceUrl: false,
  projectId: '',
  controls: { ...defaultControls },

  result: null,
  mode: 'desktop',
  generating: false,
  error: null,
  seed: 0,
  saved: false,
  editing: false,
  prevSignature: null,
  prevInspirationKey: null,
  uniquenessWarning: null,
  blueprint: null,

  newComposition: () => get().applyControl({ compositionSeed: (get().controls.compositionSeed || 0) + 1 }),
  forceStyle: () => get().applyControl({ forceReferenceStyle: true, referenceStrength: 1 }),
  freshLayout: () => {
    set({ result: null, prevSignature: null })
    void get().generate()
  },
  reanalyzeReference: () => {
    set({ blueprint: null, result: null, prevSignature: null })
    void get().generate()
  },
  // erzwingt echte Kunde-A-Palette: Sperre lösen, damit das Mapping neu greift
  enforceCustomerColors: () => get().applyControl({ brandMode: 'customer-only', brandStrength: 100, paletteLocked: false, lockedPalette: undefined }),

  setSource: (p) => set((s) => ({ source: { ...s.source, ...p } })),
  setServices: (csv) => set((s) => ({ source: { ...s.source, services: csv.split(',').map((x) => x.trim()).filter(Boolean) } })),
  setLogo: (dataUrl) => {
    set((s) => ({ source: { ...s.source, logoDataUrl: dataUrl, logoColors: dataUrl ? s.source.logoColors : undefined } }))
    if (dataUrl)
      extractLogoColors(dataUrl).then((cols) =>
        set((s) => (s.source.logoDataUrl === dataUrl ? { source: { ...s.source, logoColors: cols } } : {}))
      )
  },
  reextractLogoColors: () => {
    const url = get().source.logoDataUrl
    if (url) extractLogoColors(url).then((cols) => set((s) => ({ source: { ...s.source, logoColors: cols } })))
  },
  // Referenzwechsel → alten Entwurf UND alte Blueprint verwerfen (kein „hängengebliebenes“ Layout)
  setInspiration: (ref) => set({ inspiration: ref, result: null, error: null, editing: false, blueprint: null, prevSignature: get().prevSignature }),
  setInspirationFromCompetitor: (c) => set({ inspiration: refFromCompetitor(c), result: null, error: null, editing: false, blueprint: null }),
  setSourceFromTarget: (t) =>
    set({
      source: {
        name: t.companyName || '',
        url: t.finalUrl,
        industry: t.industry,
        location: t.location,
        services: t.services,
        targetGroup: t.targetAudience,
        colors: t.colors.map((c) => c.hex),
        screenshot: t.screenshotDesktop,
        weaknesses: t.weaknesses,
        fromAnalysis: true
      }
    }),
  setField: (p) => set(p),
  setEditing: (v) => set({ editing: v }),
  updateConceptText: (path, value) =>
    set((s) => {
      if (!s.result) return {}
      const concept = structuredClone(s.result.concept)
      const parts = path.split(':')
      const sec = concept.sections[Number(parts[0])]
      if (!sec) return {}
      if (parts[1] === 'item') {
        const j = Number(parts[2])
        const field = parts[3] as 'title' | 'text'
        if (sec.items && sec.items[j]) sec.items[j][field] = value
      } else {
        ;(sec as unknown as Record<string, unknown>)[parts[1]] = value
      }
      return { result: { ...s.result, concept }, saved: false }
    }),

  applyControl: (patch) => {
    set((s) => ({ controls: { ...s.controls, ...patch } }))
    if (get().result) void get().generate()
  },
  applyVariant: (concept, scores) => set((s) => (s.result ? { result: { ...s.result, concept, scores } } : {})),
  toggleDetectedColor: (hex) => {
    set((s) => ({
      source: {
        ...s.source,
        detectedColors: (s.source.detectedColors || []).map((d) => (d.hex === hex ? { ...d, include: !d.include } : d))
      }
    }))
    if (get().result) void get().generate()
  },
  setColorMode: (mode) => {
    const map: Record<string, Partial<StyleControls>> = {
      'reference-keep': { brandMode: 'reference-only' },
      'customer-accent': { brandMode: 'customer-priority', brandStrength: 55 },
      'customer-strong': { brandMode: 'customer-priority', brandStrength: 90 },
      'customer-only': { brandMode: 'customer-only', brandStrength: 100 },
      auto: { brandMode: 'auto', brandStrength: undefined }
    }
    get().applyControl(map[mode] || { brandMode: 'auto' })
  },
  lockPalette: (lock) => {
    const pal = get().result?.concept.palette
    get().applyControl({ paletteLocked: lock, lockedPalette: lock ? pal : undefined })
  },
  reDetectColors: () => {
    set((s) => ({ source: { ...s.source, detectedColors: undefined, websiteColors: undefined }, analyzeSourceUrl: true }))
    if (get().result || get().source.url) void get().generate()
  },
  savePalette: async () => {
    const { projectId, result, source } = get()
    if (!projectId || !result) return
    await fetch('/api/palette', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, colors: source.colors, detected: source.detectedColors, palette: result.concept.palette })
    })
  },

  generate: async () => {
    const { source, inspiration, analyzeSourceUrl, seed, controls } = get()
    if (!inspiration) {
      set({ error: 'Bitte zuerst eine Inspirations-Website (B) wählen.' })
      return
    }
    if (!source.name.trim() && !source.url?.trim()) {
      set({ error: 'Bitte Kunde A angeben (Name oder URL).' })
      return
    }
    set({ generating: true, error: null, saved: false, editing: false })
    try {
      // gecachte Blueprint mitsenden → Regler-/Farb-Änderungen analysieren B nicht erneut
      const cachedBp = get().blueprint
      const res = await fetch('/api/design-preview/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source,
          inspiration,
          analyzeSourceUrl,
          seed,
          controls,
          referenceBlueprint: cachedBp || undefined,
          skipReferenceAnalysis: !!cachedBp,
          previousSignature: get().prevSignature || undefined,
          previousReferenceUrl: get().prevInspirationKey || undefined
        })
      })
      const data = (await res.json()) as { ok: boolean; result?: DesignPreviewResult; error?: string }
      if (data.ok && data.result) {
        // Uniqueness: hat sich die Referenz geändert, muss sich das Layout unterscheiden
        const key = inspiration?.url || inspiration?.companyName || ''
        const sig = data.result.layoutSignature || ''
        const prevSig = get().prevSignature
        const prevKey = get().prevInspirationKey
        const refChanged = !!prevKey && prevKey !== key
        let uniqueness = 90
        let warn: string | null = null
        if (refChanged && prevSig && sig === prevSig) {
          uniqueness = 25
          warn = 'Die Vorschau unterscheidet sich noch nicht stark genug von der vorherigen Referenz. Bitte „Neue Komposition“ oder „Referenzstil stärker erzwingen“.'
        } else if (!refChanged && prevSig && sig === prevSig) uniqueness = 70
        data.result.scores.layoutUniqueness = uniqueness
        set({
          result: data.result,
          mode: 'desktop',
          controls: data.result.controls,
          prevSignature: sig,
          prevInspirationKey: key,
          uniquenessWarning: warn,
          blueprint: data.result.referenceBlueprint || get().blueprint
        })
        if (data.result.sourceScreenshot) set((s) => ({ source: { ...s.source, screenshot: data.result!.sourceScreenshot } }))
      } else set({ error: data.error || 'Generierung fehlgeschlagen.' })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ generating: false })
    }
  },

  regenerate: async () => {
    set((s) => ({ seed: s.seed + 1 }))
    await get().generate()
  },

  reset: () => set({ result: null, error: null, seed: 0, saved: false, mode: 'desktop', editing: false, controls: { ...defaultControls }, blueprint: null, prevSignature: null, uniquenessWarning: null })
}))
