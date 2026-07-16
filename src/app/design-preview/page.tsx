'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, Wand2, RefreshCw, ImageDown, FileCode, Save, Upload, X, Monitor, Smartphone, SplitSquareHorizontal, Layers, Check, Trash2, Pencil, Sparkles, Copy, Download, Bug
} from 'lucide-react'
import type { DesignPreviewResult, SavedPreview, AnalysisProject, InspirationSearchProject, SavedProjectPalette, AIPreviewProvider, PreviewCodeFormat, AIPreviewResult, AIPreviewPrompt, ProviderStatus, PreviewValidation } from '@shared/types'
import { PageHeader, InfoBanner } from '@/components/ui/Ui'
import { usePreviewStore } from '@/lib/stores/previewStore'
import { usePromptStore } from '@/lib/stores/promptStore'
import { useToast } from '@/lib/stores/toastStore'
import { getJson } from '@/lib/client'
import { refFromUrl } from '@/lib/promptRef'
import { PreviewCanvas } from '@/components/PreviewCanvas'
import { ColorSwatches } from '@/components/ui/Bits'
import { shotUrl, cls, scoreColor } from '@/lib/format'
import { ARCHETYPE_OPTIONS, ARCHETYPE_LABEL, STYLE_CONTROLS } from '@/lib/categories'
import type { ProjectSummary } from '@/server/services/storage'

export default function DesignPreviewPage() {
  const [tab, setTab] = useState<'gen' | 'saved'>('gen')
  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <PageHeader
        eyebrow="Konzept"
        icon={Eye}
        title="Stil-Vorschau"
        subtitle="Sieh, wie Kunde A im allgemeinen Stil einer starken Referenz B aussehen könnte – als eigenständiges Konzept, kein Klon."
      />

      <InfoBanner tone="gold">
        Diese Vorschau ist nur ein eigenes Konzept auf Basis allgemeiner Stil-Inspiration. Keine Inhalte, Bilder, Logos, Texte, Codes oder exakten Layouts der Referenzseite übernehmen.
      </InfoBanner>

      <div className="flex gap-2">
        <button onClick={() => setTab('gen')} className={cls('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium', tab === 'gen' ? 'btn-ink' : 'btn-ghost')}>
          <Wand2 size={15} /> Vorschau erstellen
        </button>
        <button onClick={() => setTab('saved')} className={cls('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium', tab === 'saved' ? 'btn-ink' : 'btn-ghost')}>
          <Layers size={15} /> Gespeicherte Vorschauen
        </button>
      </div>

      {tab === 'gen' ? <Generator /> : <SavedList />}
    </div>
  )
}

function Generator() {
  const s = usePreviewStore()
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <CompanyACard />
        <CompanyBCard />
      </div>

      {s.error && <div className="card border-red-300/60 bg-red-50/60 p-4 text-sm text-red-700">{s.error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={s.generate} disabled={s.generating || !s.inspiration} className="btn-ink inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium">
          {s.generating ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />} {s.generating ? 'Analysiere …' : 'Kunde A & B analysieren'}
        </button>
        {s.result && (
          <button onClick={s.regenerate} disabled={s.generating} className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm">
            <RefreshCw size={15} /> Neu analysieren
          </button>
        )}
        {!s.result && <span className="text-xs text-[var(--color-muted)]">Analysiert Farben/Logo/Bilder von A und die Struktur von B – danach erscheint die KI-Vorschau.</span>}
      </div>

      {s.result && <AIPreviewPanel />}
    </div>
  )
}

function CompanyACard() {
  const { source, setSource, setServices, setLogo, analyzeSourceUrl, setField } = usePreviewStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [showProjects, setShowProjects] = useState(false)
  const setSourceFromTarget = usePreviewStore((st) => st.setSourceFromTarget)
  const toast = useToast((t) => t.show)

  useEffect(() => {
    getJson<ProjectSummary[]>('/api/projects').then((p) => setProjects(p.filter((x) => x.mode === 'url'))).catch(() => {})
  }, [])

  const onLogo = (file?: File) => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => setLogo(r.result as string)
    r.readAsDataURL(file)
  }
  const loadProject = async (id: string) => {
    const p = await getJson<AnalysisProject>(`/api/projects/${id}`)
    if (p.target) {
      setSourceFromTarget(p.target)
      toast('Kundendaten aus Projekt übernommen', 'success')
      setShowProjects(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg">Kunde A</h3>
        <button onClick={() => setShowProjects((v) => !v)} className="text-sm text-[var(--color-gold)] hover:underline">aus Projekt laden</button>
      </div>
      {showProjects && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-[var(--color-line)] p-2">
          {projects.length ? projects.map((p) => (
            <button key={p.id} onClick={() => loadProject(p.id)} className="chip rounded-lg px-2.5 py-1 text-xs">{p.title}</button>
          )) : <span className="text-xs text-[var(--color-muted)]">Keine URL-Analyse-Projekte vorhanden.</span>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Fld label="Firmenname"><input className="inp" value={source.name} onChange={(e) => setSource({ name: e.target.value })} placeholder="z. B. Café Sonne" /></Fld>
        <Fld label="Website-URL (optional)"><input className="inp" value={source.url} onChange={(e) => setSource({ url: e.target.value })} placeholder="https://…" /></Fld>
        <Fld label="Branche"><input className="inp" value={source.industry} onChange={(e) => setSource({ industry: e.target.value })} /></Fld>
        <Fld label="Standort"><input className="inp" value={source.location} onChange={(e) => setSource({ location: e.target.value })} /></Fld>
        <Fld label="Leistungen (kommagetrennt)"><input className="inp" value={source.services.join(', ')} onChange={(e) => setServices(e.target.value)} /></Fld>
        <Fld label="Zielgruppe"><input className="inp" value={source.targetGroup} onChange={(e) => setSource({ targetGroup: e.target.value })} /></Fld>
        <Fld label="Marken-Farben (Hex, kommagetrennt)"><input className="inp" value={source.colors.join(', ')} onChange={(e) => setSource({ colors: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="#1e1e22, #b08d57" /></Fld>
        <Fld label="Logo">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"><Upload size={14} /> hochladen</button>
            {source.logoDataUrl && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.logoDataUrl} alt="Logo" className="h-7 object-contain" />
                <button onClick={() => setLogo(undefined)} className="hover:text-[var(--color-ink)]"><X size={13} /></button>
              </span>
            )}
          </div>
        </Fld>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        <input type="checkbox" checked={analyzeSourceUrl} onChange={(e) => setField({ analyzeSourceUrl: e.target.checked })} /> Bestehende Website analysieren (Farben/Inhalte/Schwächen automatisch)
      </label>
    </div>
  )
}

function CompanyBCard() {
  const { inspiration, setInspiration } = usePreviewStore()
  const [url, setUrl] = useState('')
  if (inspiration) {
    const weak = inspiration.visualScore != null && inspiration.visualScore < 75
    const shot = shotUrl(inspiration.screenshot)
    return (
      <div className="card p-5">
        <h3 className="mb-3 font-display text-lg">Referenz B (Stilvorlage)</h3>
        <div className="flex gap-3">
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="" className="h-24 w-36 shrink-0 rounded-lg border border-[var(--color-line)] object-cover object-top" />
          )}
          <div className="min-w-0">
            <div className="font-medium">{inspiration.companyName || inspiration.url}</div>
            <div className="truncate text-xs text-[var(--color-muted)]">
              {inspiration.url} · Stil: {inspiration.designStyle || '—'}
              {inspiration.visualScore != null && ` · optischer Score ${inspiration.visualScore}`}
            </div>
            <div className="mt-1"><ColorSwatches colors={inspiration.colors.map((hex) => ({ hex }))} /></div>
          </div>
        </div>
        {weak && (
          <div className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50/60 p-2 text-xs text-amber-800">
            Diese Referenz ist optisch nicht stark genug. Sie kann für Inhalte/Struktur genutzt werden, ist aber nicht als Design-Vorlage empfohlen.
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-display text-lg">Referenz B (Stilvorlage)</h3>
      <p className="mb-2 text-sm text-[var(--color-muted)]">Wähle in der Inspiration-Suche eine Webseite und klicke „Vorschau mit diesem Stil“ – oder füge hier eine URL ein.</p>
      <div className="flex gap-2">
        <input className="inp flex-1" placeholder="https://referenz-website.de" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button onClick={() => url.trim() && setInspiration(refFromUrl(url.trim()))} className="btn-ghost rounded-lg px-3 py-2 text-sm">Übernehmen</button>
      </div>
    </div>
  )
}

function PreviewArea({ result }: { result: DesignPreviewResult }) {
  const { mode, setField, source, inspiration, projectId, editing, setEditing, updateConceptText, controls, applyControl, generating, reextractLogoColors, applyVariant, toggleDetectedColor, lockPalette, savePalette, reDetectColors, forceStyle, newComposition, freshLayout, uniquenessWarning, reanalyzeReference, enforceCustomerColors } = usePreviewStore()
  const router = useRouter()
  const toast = useToast((t) => t.show)
  const setPromptInspiration = usePromptStore((s) => s.setInspiration)
  const setPromptTarget = usePromptStore((s) => s.setTarget)
  const setPromptField = usePromptStore((s) => s.setField)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => { getJson<ProjectSummary[]>('/api/projects').then(setProjects).catch(() => {}) }, [])

  const exportFile = async (format: 'png' | 'html') => {
    setBusy(format)
    try {
      const res = await fetch('/api/design-preview/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ concept: result.concept, format }) })
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(result.concept.companyName || 'vorschau').replace(/[^a-z0-9]/gi, '_')}_vorschau.${format}`
      a.click()
      URL.revokeObjectURL(a.href)
      toast(format === 'png' ? 'Vorschau als Bild exportiert' : 'Vorschau als HTML exportiert', 'success')
    } catch {
      toast('Export fehlgeschlagen', 'error')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    const res = await fetch('/api/previews', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: `${result.concept.companyName} – Stil-Vorschau`, company: result.concept.companyName, inspirationSource: result.inspiration.name || result.inspiration.url || '—', projectId: projectId || undefined, result })
    })
    if (res.ok) { setSaved(true); toast(projectId ? 'Vorschau im Projekt gespeichert ✓' : 'Vorschau gespeichert ✓', 'success'); setTimeout(() => setSaved(false), 2000) }
    else toast('Speichern fehlgeschlagen', 'error')
  }

  const promptFromPreview = () => {
    if (inspiration) setPromptInspiration(inspiration)
    setPromptTarget({
      companyName: source.name, url: source.url, industry: source.industry, location: source.location,
      services: source.services.join(', '), targetGroup: source.targetGroup, goal: ''
    })
    const sp = result.styleProfile
    const isDarkRest = sp.archetype === 'dark-cinematic-restaurant'
    const archInstruction = isDarkRest
      ? 'Erzeuge ein DUNKLES, cinematisches Restaurant-Layout: Vollbild-Hero mit großem Food-/Interieur-Bild und dunklem Overlay, Navigation über dem Hero mit prominentem/zentriertem Logo, große elegante Serif-Headline, kleines letter-spaced Eyebrow, Reservierungs-CTA „Tisch reservieren“, untere Reservierungsleiste, Food-Galerie und Speisekarten-Sektion. KEINE weißen SaaS-Layouts, KEINE blauen Buttons, KEINE grauen Platzhalter-Boxen.'
      : `Setze den Archetyp „${ARCHETYPE_LABEL[sp.archetype] || sp.archetype}“ um: ${sp.layoutType}.`
    const pal = result.concept.palette
    const profileText = [
      `Stilquelle (Referenz B): ${result.inspiration.name || result.inspiration.url || '—'} – Archetyp ${ARCHETYPE_LABEL[sp.archetype] || sp.archetype}`,
      `Markenquelle (Kunde A): ${source.name || '—'} (Branding-Quelle: ${result.brandSource.winner}, Stärke ${result.brandStrength}/100)`,
      `Wirkung: ${sp.visualMood} (${sp.emotionalMood}); Hintergrund: ${sp.backgroundStyle}, Typografie: ${sp.typographyMood === 'serif-display' ? 'elegante Serif' : 'moderne Sans'}`,
      `Hero: ${sp.heroType}, Navigation: ${sp.navPosition}, CTA: ${sp.ctaStyle}`,
      `Finale Farb-Tokens: --preview-bg ${pal.paper}, --preview-text ${pal.ink}, --preview-primary ${pal.primary}, --preview-accent ${pal.accent}, --preview-cta ${pal.cta} (hover ${pal.ctaHover})`,
      `Bilder: ${result.imageSummary.used} echte Bilder von Kunde A genutzt, ${result.imageSummary.placeholders} Platzhalter`,
      `Qualität: Style ${result.scores.style}, Brand ${result.scores.brand}, Presentable ${result.scores.presentable}`,
      `Sektionen: ${result.concept.sections.map((x) => x.type).join(' → ')}`
    ].join('\n')
    setPromptField({ editedPrompt: '' })
    setPromptTarget({
      notes:
        `Basierend auf der generierten Design-Vorschau. Stil = Referenz B, Branding/Farben = Kunde A.\n\n` +
        `${archInstruction}\n\nStil- & Brand-Profil:\n${profileText}\n\n` +
        'Nutze die Marken-Farben von Kunde A für Akzent/CTA/Details, behalte die Designsprache & Stimmung der Referenz. Verwende echte Bilder von Kunde A, ersetze Platzhalter später durch hochwertige Fotos.\n' +
        'WICHTIG: Referenz nur als Inspiration nutzen – keine Texte, Bilder, Logos, Code oder exakten Layouts 1:1 kopieren. Eigenständiges Design für Kunde A.'
    })
    toast('Daten + Stilprofil in den Prompt Generator übernommen', 'success')
    router.push('/prompt-generator')
  }

  const MODES = [
    { v: 'desktop', label: 'Desktop', icon: <Monitor size={14} /> },
    { v: 'mobile', label: 'Mobil', icon: <Smartphone size={14} /> },
    { v: 'before-after', label: 'Vorher/Nachher', icon: <SplitSquareHorizontal size={14} /> },
    { v: 'reference', label: 'Referenz', icon: <Layers size={14} /> }
  ] as const

  const sp = result.styleProfile
  const heroLabel: Record<string, string> = { 'cinematic-full': 'Cinematic Vollbild', 'split-image': 'Split-Bild', centered: 'Zentriert', standard: 'Standard' }
  const matchGood = result.styleMatch.score >= 80

  return (
    <div className="space-y-4">
      {result.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 p-3 text-xs text-amber-800">
          {result.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      {/* Qualitäts-Scores */}
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-4">
          <ScoreCell label="Style Match" value={result.scores.style} hint="Referenz B" />
          <ScoreCell label="Brand Match" value={result.scores.brand} hint="Branding A" />
          <ScoreCell label="Client-Presentable" value={result.scores.presentable} hint="Kundenvorschau" />
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-[var(--color-muted)]">
          {result.blueprintMatch && (
            <span>Blueprint-Treue: <b style={{ color: scoreColor(result.blueprintMatch.score) }}>{result.blueprintMatch.score}</b></span>
          )}
          {result.scores.layoutUniqueness != null && (
            <span>Layout-Einzigartigkeit: <b style={{ color: scoreColor(result.scores.layoutUniqueness) }}>{result.scores.layoutUniqueness}</b></span>
          )}
          {result.scores.paletteAccuracy != null && (
            <span>Paletten-Genauigkeit: <b style={{ color: scoreColor(result.scores.paletteAccuracy) }}>{result.scores.paletteAccuracy}</b></span>
          )}
          <button onClick={() => setShowDebug((v) => !v)} className="underline hover:text-[var(--color-ink)]">{showDebug ? 'Debug ausblenden' : 'Style-Debug'}</button>
        </div>
        {showDebug && (
          <div className="mt-2 rounded-lg bg-[var(--color-paper-2)]/50 p-3 font-mono text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
            <div>Referenz: {result.inspiration.url || result.inspiration.name || '—'}</div>
            <div>Archetyp: {result.styleProfile.archetype} · Template: {result.chosenTemplate || '—'} {result.fallbackUsed ? '· FALLBACK' : ''}</div>
            <div>Fingerprint: {result.fingerprint ? `dark ${result.fingerprint.darkness} · elegant ${result.fingerprint.elegance} · minimal ${result.fingerprint.minimalism} · cinematic ${result.fingerprint.cinematic} · warm ${result.fingerprint.warmth} · imagery ${result.fingerprint.imagery}` : '—'}</div>
            <div>Layout-Signatur: {result.layoutSignature || '—'}</div>
            {result.referenceBlueprint && (
              <>
                <div className="mt-1 border-t border-[var(--color-line)] pt-1">
                  <b>Blueprint {result.referenceBlueprint.ok ? 'genutzt ✓' : 'FEHLGESCHLAGEN → Fallback-Template'}</b>{result.fallbackUsed ? ' · FALLBACK (nicht kundentauglich)' : ''}
                </div>
                <div>· Header/Nav: {result.referenceBlueprint.navPosition}{result.referenceBlueprint.logoPosition === 'center' ? ' · Logo mittig' : ' · Logo links'}{result.referenceBlueprint.navHasCta ? ' · Nav-CTA' : ''}{result.referenceBlueprint.navSticky ? ' · sticky' : ''}</div>
                <div>· Hero: {result.referenceBlueprint.heroType} · Text {result.referenceBlueprint.heroTextAlign} · {result.referenceBlueprint.heroOverlay ? 'Overlay' : 'kein Overlay'} · Bild {result.referenceBlueprint.imageDominant ? 'dominant' : 'dezent'}</div>
                <div>· Reihenfolge Referenz: {result.referenceBlueprint.sectionSequence?.join(' → ') || '—'}</div>
                <div>· Reihenfolge generiert: {result.generatedSectionOrder?.join(' → ') || '—'}</div>
                <div>· Footer-Spalten: {result.referenceBlueprint.footerColumns} · bg {result.referenceBlueprint.backgroundStyle} · {result.referenceBlueprint.typography}{result.referenceBlueprint.hasSlider ? ' · Slider' : ''}{result.referenceBlueprint.reservationCta ? ' · Reservierungs-CTA' : ''}</div>
              </>
            )}
            {result.layoutStale && <div className="text-amber-600">⚠ Layout trotz Referenzwechsel identisch – Blueprint nicht angewendet.</div>}
            {result.blueprintMatch && result.blueprintMatch.notes.length > 0 && (
              <div>Blueprint-Abweichungen: {result.blueprintMatch.notes.join('; ')}</div>
            )}
            <div>Palette-Quelle: {result.brandSource.winner} · Modus: {result.brandTransferMode} · gesperrt: {controls.paletteLocked ? 'ja' : 'nein'}</div>
            <div>Tokens: bg {result.concept.palette.paper} · text {result.concept.palette.ink} · accent {result.concept.palette.accent} · cta {result.concept.palette.cta}</div>
            {result.paletteSources && Object.entries(result.paletteSources).map(([k, v]) => (
              <div key={k}>· {k}: {v}</div>
            ))}
            {result.scoreReasons && result.scoreReasons.length > 0 && (
              <div className="mt-1 border-t border-[var(--color-line)] pt-1">
                {result.scoreReasons.map((rr, i) => <div key={i}>» {rr}</div>)}
              </div>
            )}
          </div>
        )}
        {result.fallbackUsed && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            ⚠ Fallback-Template genutzt – Referenz B konnte nicht live analysiert werden. Struktur ist nur geschätzt (Style Match ≤ 60), nicht kundentauglich.
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={cls('rounded-full px-3 py-1 text-xs font-medium', result.scores.ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
            {result.scores.ready ? '✓ Bereit für Kundenvorschau' : 'Noch optimieren für Kundenvorschau'}
          </span>
          {!result.scores.ready && (
            <button onClick={() => applyControl({ brandStrength: 80, moreBranding: true, referenceStrength: 1, useCustomerImages: true })} className="btn-ink rounded-lg px-3 py-1.5 text-xs font-medium">
              Für Kundenvorschau optimieren
            </button>
          )}
        </div>
      </div>

      {/* Stilprofil */}
      <div className="grid gap-4">
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold">Erkanntes Stilprofil (Referenz B)</div>
          <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Prof label="Archetyp" value={ARCHETYPE_LABEL[sp.archetype] || sp.archetype} strong />
            <Prof label="Hero-Typ" value={heroLabel[sp.heroType] || sp.heroType} />
            <Prof label="Hintergrund" value={sp.backgroundStyle === 'dark' ? 'dunkel' : sp.backgroundStyle === 'cream' ? 'creme' : 'hell'} />
            <Prof label="Typografie" value={sp.typographyMood === 'serif-display' ? 'elegante Serif' : 'moderne Sans'} />
            <Prof label="Navigation" value={sp.navPosition === 'over-hero' ? 'über dem Hero' : 'Top-Leiste'} />
            <Prof label="CTA-Stil" value={sp.ctaStyle} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[var(--color-muted)]">Farben:</span>
            <ColorSwatches colors={result.inspiration.colors.map((hex) => ({ hex }))} />
            <span className="text-xs text-[var(--color-muted)]">· {sp.premiumSignals.slice(0, 3).join(' · ')}</span>
          </div>
        </div>
      </div>

      {/* Stil-Regler */}
      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Stil anpassen:</span>
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            Archetyp
            <select
              value={controls.archetypeOverride || ''}
              onChange={(e) => applyControl({ archetypeOverride: (e.target.value || undefined) as never })}
              className="inp h-8 w-56"
            >
              <option value="">automatisch erkannt</option>
              {ARCHETYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {generating && <span className="text-xs text-[var(--color-muted)]">… aktualisiere</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {STYLE_CONTROLS.map((b) => (
            <button key={b.label} onClick={() => applyControl(b.patch)} disabled={generating} className="chip rounded-full px-3 py-1.5 text-xs">
              {b.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-2">
          <span className="self-center text-xs text-[var(--color-muted)]">Referenz-Struktur:</span>
          <button onClick={forceStyle} disabled={generating} className="btn-ink rounded-full px-3 py-1.5 text-xs">Referenzstruktur stärker übernehmen</button>
          <button onClick={reanalyzeReference} disabled={generating || !inspiration?.url} className="btn-ghost rounded-full px-3 py-1.5 text-xs">Aus Referenz neu analysieren</button>
          <button onClick={enforceCustomerColors} disabled={generating} className="btn-ghost rounded-full px-3 py-1.5 text-xs">Kundenfarben erzwingen</button>
          <button onClick={newComposition} disabled={generating} className="btn-ghost rounded-full px-3 py-1.5 text-xs">Neue Komposition</button>
          <button onClick={freshLayout} disabled={generating} className="btn-ghost rounded-full px-3 py-1.5 text-xs">Frisches Layout</button>
        </div>
      </div>

      {uniquenessWarning && (
        <div className="card border-amber-300/60 bg-amber-50/60 p-3 text-sm text-amber-800">⚠️ {uniquenessWarning}</div>
      )}

      {/* Kundenfarben (immer aktiv – Referenz liefert nur Struktur/Rollen) */}
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
          🎨 Kundenfarben
          <span className="text-xs font-normal text-[var(--color-muted)]">· immer aktiv – Referenz B bestimmt nur Struktur &amp; Farbrollen · Quelle: {result.brandSource.winner}</span>
          <label className="ml-auto inline-flex items-center gap-2 text-xs font-normal text-[var(--color-ink-soft)]">
            <input type="checkbox" checked={!!controls.paletteLocked} onChange={(e) => lockPalette(e.target.checked)} /> 🔒 Palette sperren
          </label>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="mb-1 text-xs text-[var(--color-muted)]">Palette manuell korrigieren</div>
            <div className="flex flex-wrap items-center gap-3">
              <ColorField label="Primär" value={controls.primaryColor || result.brandProfile.primary} onChange={(v) => applyControl({ primaryColor: v })} />
              <ColorField label="Sekundär" value={controls.secondaryColor || result.brandProfile.secondary} onChange={(v) => applyControl({ secondaryColor: v })} />
              <ColorField label="Akzent / CTA" value={controls.accentColor || result.brandProfile.accent} onChange={(v) => applyControl({ accentColor: v })} />
            </div>
            <label className="block text-xs text-[var(--color-muted)]">
              Hintergrund-Rolle (Struktur)
              <select value={controls.darknessOverride || 'auto'} onChange={(e) => applyControl({ darknessOverride: (e.target.value === 'auto' ? undefined : e.target.value) as never })} className="inp mt-1 h-8">
                <option value="auto">wie Referenz</option>
                <option value="lighter">hell</option>
                <option value="darker">dunkel</option>
              </select>
            </label>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs text-[var(--color-muted)]">Finale Palette</div>
              <div className="flex flex-wrap gap-2">
                {[['Primär', result.concept.palette.primary], ['Sekundär', result.concept.palette.secondary], ['Akzent', result.concept.palette.accent], ['BG', result.concept.palette.paper], ['Text', result.concept.palette.ink], ['CTA', result.concept.palette.cta], ['Hover', result.concept.palette.ctaHover]].map(([n, hex]) => (
                  <div key={n} className="text-center">
                    <div className="h-9 w-12 rounded-md border border-black/10" style={{ background: hex }} />
                    <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{n}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { const lc = source.logoColors || []; if (lc[0]) applyControl({ primaryColor: lc[0], accentColor: lc[0], secondaryColor: lc[1] }) }} disabled={generating || !(source.logoColors || []).length} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">Logo-Farben anwenden</button>
              <button onClick={reextractLogoColors} disabled={!source.logoDataUrl} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">Farben aus Logo neu erkennen</button>
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">
              Logo-Farben: {(source.logoColors || []).join(', ') || '—'} · Website: {(result.brandSource.websiteColors || []).slice(0, 3).join(', ') || '—'} · Manuell: {(result.brandSource.manualColors || []).join(', ') || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Erkannte Kundenfarben */}
      <div className="card p-5">
        <div className="mt-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Erkannte Kundenfarben</span>
            <button onClick={reDetectColors} disabled={generating || !source.url} className="btn-ink rounded-lg px-2.5 py-1 text-xs">Farben aus Kunde A neu erkennen</button>
            <button onClick={async () => { await savePalette(); toast('Kundenpalette gespeichert', 'success') }} disabled={!projectId} className="btn-ghost rounded-lg px-2.5 py-1 text-xs" title={projectId ? '' : 'Erst einem Projekt zuordnen'}>Als Kundenpalette speichern</button>
            <button onClick={async () => { if (!projectId) return; const p = await getJson<SavedProjectPalette | null>(`/api/palette?project=${projectId}`); if (p?.palette) { applyControl({ paletteLocked: true, lockedPalette: p.palette }); toast('Gespeicherte Palette geladen & gesperrt', 'success') } else toast('Keine gespeicherte Palette', 'info') }} disabled={!projectId} className="btn-ghost rounded-lg px-2.5 py-1 text-xs">Gespeicherte Palette laden</button>
          </div>
          {!source.detectedColors?.length ? (
            <p className="text-xs text-[var(--color-muted)]">
              {source.url ? 'Aktiviere „Bestehende Website analysieren“ in Kunde A und generiere neu, um echte Markenfarben zu erkennen.' : 'Keine Kunden-URL angegeben – Farben manuell setzen oder Logo hochladen.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {source.detectedColors.map((d) => (
                <div key={d.hex} className={cls('flex items-center gap-2 rounded-lg border p-1.5 pr-2 text-left', d.include ? 'border-[var(--color-gold)] bg-[var(--color-paper-2)]/60' : 'border-[var(--color-line)] opacity-55')} title={d.reason}>
                  <button onClick={() => toggleDetectedColor(d.hex)} title={d.include ? 'verwerfen' : 'wieder aufnehmen'} className="h-7 w-7 shrink-0 rounded-md border border-black/10" style={{ background: d.hex }} />
                  <span className="text-[11px] leading-tight">
                    <span className="font-medium">{d.hex}</span><br />
                    <span className="text-[var(--color-muted)]">{d.source} · {d.role} · {d.confidence}{d.include ? ' ✓' : ' ✗'}</span>
                  </span>
                  <span className="ml-1 flex flex-col gap-0.5">
                    <button onClick={() => applyControl({ primaryColor: d.hex })} title="als Primär setzen" className="rounded border border-[var(--color-line)] px-1 text-[9px] leading-4 hover:bg-[var(--color-paper-2)]">P</button>
                    <button onClick={() => applyControl({ secondaryColor: d.hex })} title="als Sekundär setzen" className="rounded border border-[var(--color-line)] px-1 text-[9px] leading-4 hover:bg-[var(--color-paper-2)]">S</button>
                    <button onClick={() => applyControl({ accentColor: d.hex })} title="als Akzent/CTA setzen" className="rounded border border-[var(--color-line)] px-1 text-[9px] leading-4 hover:bg-[var(--color-paper-2)]">A</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* Manuelle HEX-Farbe ergänzen */}
          <ManualHexAdd onAdd={(hex) => usePreviewStore.getState().setSource({ colors: [...(source.colors || []), hex] })} />
        </div>

        {/* Validierung + Vergleich */}
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
          <div className="text-xs text-[var(--color-ink-soft)]">
            {result.colorValidation && (
              <>
                <div className="mb-1 flex gap-4">
                  <span>Brand-Color-Match: <b style={{ color: scoreColor(result.colorValidation.brandColorMatch) }}>{result.colorValidation.brandColorMatch}</b></span>
                  <span>Kontrast: <b style={{ color: scoreColor(result.colorValidation.contrast) }}>{result.colorValidation.contrast}</b></span>
                  <span>Stil-Erhalt: <b style={{ color: scoreColor(result.colorValidation.stylePreservation) }}>{result.colorValidation.stylePreservation}</b></span>
                </div>
                {result.colorValidation.warnings.map((w, i) => <div key={i} className="text-amber-700">⚠️ {w}</div>)}
              </>
            )}
          </div>
          <div className="space-y-1.5 text-[11px]">
            <CmpRow label="Erkannt (A)" hexes={(source.detectedColors || []).filter((d) => d.include).slice(0, 6).map((d) => d.hex)} />
            <CmpRow label="Vorschau" hexes={[result.concept.palette.primary, result.concept.palette.accent, result.concept.palette.cta, result.concept.palette.paper, result.concept.palette.ink]} />
            <CmpRow label="Referenz B" hexes={result.inspiration.colors.slice(0, 6)} />
          </div>
        </div>
      </div>

      {/* Bilder & Medien */}
      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">🖼️ Bilder &amp; Medien</span>
          <label className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
            <input type="checkbox" checked={controls.useCustomerImages !== false} onChange={(e) => applyControl({ useCustomerImages: e.target.checked })} /> Bilder von Kunde A verwenden
          </label>
          <button onClick={() => applyControl({ imageryOverride: 'more' })} disabled={generating} className="chip rounded-full px-3 py-1 text-xs">Mehr Bilder</button>
          <button onClick={() => usePreviewStore.getState().regenerate()} disabled={generating} className="chip rounded-full px-3 py-1 text-xs">Bilder neu zuordnen</button>
        </div>
        <div className="text-xs text-[var(--color-muted)]">
          {source.url ? (
            <>Gefunden: <b className="text-[var(--color-ink)]">{result.imageSummary.found}</b> · genutzt: <b className="text-[var(--color-ink)]">{result.imageSummary.used}</b> · Platzhalter: {result.imageSummary.placeholders}{result.imageSummary.fit ? ` · Image-Fit ${result.imageSummary.fit.score}` : ''}</>
          ) : (
            <>Keine Kunden-URL angegeben – aktiviere „Bestehende Website analysieren“ in Kunde A, um echte Bilder zu nutzen.</>
          )}
        </div>
        {result.imageSummary.recommendations.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-700">
            {result.imageSummary.recommendations.slice(0, 3).map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        )}
      </div>

      {/* 3 Konzeptvarianten */}
      {result.variants && result.variants.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold">3 Konzeptvarianten</div>
          <div className="grid grid-cols-3 gap-2">
            {result.variants.map((v) => (
              <button key={v.label} onClick={() => applyVariant(v.concept, v.scores)} className="rounded-xl border border-[var(--color-line)] p-3 text-left transition hover:border-[var(--color-gold)]">
                <div className="text-sm font-medium">{v.label}</div>
                <div className="text-[11px] text-[var(--color-muted)]">Brand {v.scores.brand} · Präsentabel {v.scores.presentable}</div>
                <div className="mt-1.5 flex gap-1">
                  {[v.concept.palette.paper, v.concept.palette.accent, v.concept.palette.cta].map((h, i) => <span key={i} className="h-4 w-6 rounded border border-black/10" style={{ background: h }} />)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button key={m.v} onClick={() => setField({ mode: m.v })} className={cls('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm', mode === m.v ? 'btn-ink' : 'btn-ghost')}>
            {m.icon} {m.label}
          </button>
        ))}
        {mode !== 'reference' && (
          <button
            onClick={() => setEditing(!editing)}
            className={cls('ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm', editing ? 'bg-[var(--color-gold)] text-white' : 'btn-ghost')}
          >
            {editing ? <Check size={14} /> : <Pencil size={14} />} {editing ? 'Bearbeiten beenden' : 'Texte bearbeiten'}
          </button>
        )}
      </div>

      {editing && mode !== 'reference' && (
        <div className="rounded-lg border border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          ✏️ Klicke in der Vorschau direkt auf Überschriften, Texte oder Buttons und überschreibe sie. Änderungen fließen in Export &amp; Speichern ein.
        </div>
      )}

      <div className="card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="rounded-full bg-[var(--color-paper-2)] px-2 py-0.5">Konzept-Mockup</span>
          <span>Stil: {result.styleProfile.visualMood}</span>
        </div>

        {mode === 'desktop' && <PreviewCanvas concept={result.concept} device="desktop" editable={editing} onEdit={updateConceptText} />}
        {mode === 'mobile' && <PreviewCanvas concept={result.concept} device="mobile" editable={editing} onEdit={updateConceptText} />}
        {mode === 'before-after' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-[var(--color-muted)]">Vorher (Original A)</div>
              {shotUrl(result.sourceScreenshot) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shotUrl(result.sourceScreenshot)} alt="Original" className="w-full rounded-xl border border-[var(--color-line)]" />
              ) : (
                <div className="grid h-48 place-items-center rounded-xl border border-dashed border-[var(--color-line)] text-xs text-[var(--color-muted)]">Kein Original-Screenshot (URL analysieren aktivieren)</div>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-[var(--color-muted)]">Nachher (Konzept)</div>
              <PreviewCanvas concept={result.concept} device="desktop" editable={editing} onEdit={updateConceptText} />
            </div>
          </div>
        )}
        {mode === 'reference' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            {shotUrl(result.inspiration.screenshot) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shotUrl(result.inspiration.screenshot)} alt="Referenz" className="w-full rounded-xl border border-[var(--color-line)]" />
            ) : (
              <div className="grid h-48 place-items-center rounded-xl border border-dashed border-[var(--color-line)] text-xs text-[var(--color-muted)]">Kein Referenz-Screenshot</div>
            )}
            <div className="space-y-2 text-sm">
              <div><b>Referenz:</b> {result.inspiration.name || result.inspiration.url}</div>
              <div><b>Stil:</b> {result.inspiration.designStyle}</div>
              <div className="flex items-center gap-2"><b>Farben:</b> <ColorSwatches colors={result.inspiration.colors.map((hex) => ({ hex }))} /></div>
              <div className="text-xs text-[var(--color-muted)]">{result.styleProfile.premiumSignals.join(' · ')}</div>
            </div>
          </div>
        )}
      </div>

      {/* Design-Entscheidung */}
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-sm font-semibold">Von Referenz B (Stil)</div>
          <ul className="space-y-0.5 text-xs text-[var(--color-ink-soft)]">
            {result.designDecision.fromReference.map((x, i) => <li key={i}>• {x}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1.5 text-sm font-semibold">Von Kunde A (Marke & Inhalt)</div>
          <ul className="space-y-0.5 text-xs text-[var(--color-ink-soft)]">
            {result.designDecision.fromCustomer.map((x, i) => <li key={i}>• {x}</li>)}
          </ul>
        </div>
        <div className="sm:col-span-2 rounded-lg bg-[var(--color-paper-2)]/50 p-3 text-xs text-[var(--color-ink-soft)]">
          <b>Farb-Anpassung:</b> {result.designDecision.colorAdaptation}<br />
          <b>Kundenvorschau:</b> {result.designDecision.presentation}
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={promptFromPreview} className="btn-ink inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"><Wand2 size={15} /> Prompt aus Vorschau erstellen</button>
        <button onClick={() => exportFile('png')} disabled={busy === 'png'} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"><ImageDown size={15} /> {busy === 'png' ? '…' : 'Als Bild (PNG)'}</button>
        <button onClick={() => exportFile('html')} disabled={busy === 'html'} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"><FileCode size={15} /> Als HTML</button>
        <div className="ml-auto flex items-center gap-2">
          {projects.length > 0 && (
            <select value={projectId} onChange={(e) => setField({ projectId: e.target.value })} className="inp w-44">
              <option value="">keinem Projekt</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <button onClick={save} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm">{saved ? <Check size={15} /> : <Save size={15} />} {saved ? 'Gespeichert' : 'Im Projekt speichern'}</button>
        </div>
      </div>
      <p className="text-xs text-[var(--color-muted)]">{result.legalNote}</p>
    </div>
  )
}

function SavedList() {
  const [list, setList] = useState<Omit<SavedPreview, 'result'>[]>([])
  const router = useRouter()
  const store = usePreviewStore()
  const toast = useToast((t) => t.show)
  const refresh = () => getJson<Omit<SavedPreview, 'result'>[]>('/api/previews').then(setList).catch(() => {})
  useEffect(() => { refresh() }, [])

  const open = async (id: string) => {
    const p = await getJson<SavedPreview>(`/api/previews/${id}`)
    usePreviewStore.setState({ result: p.result, inspiration: store.inspiration, mode: 'desktop' })
    toast('Vorschau geladen – Tab „Vorschau erstellen“', 'info')
  }
  const del = async (id: string) => { await fetch(`/api/previews/${id}`, { method: 'DELETE' }); refresh() }

  if (list.length === 0) return <div className="card p-6 text-sm text-[var(--color-muted)]">Noch keine gespeicherten Vorschauen.</div>
  return (
    <div className="space-y-3">
      {list.map((p) => (
        <div key={p.id} className="card flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-paper-2)] text-[var(--color-gold)]"><Eye size={17} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{p.title}</div>
            <div className="truncate text-xs text-[var(--color-muted)]">Referenz: {p.inspirationSource} · {new Date(p.createdAt).toLocaleString('de-DE')}</div>
          </div>
          <button onClick={() => open(p.id).then(() => router.refresh())} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">laden</button>
          <button onClick={() => del(p.id)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</span>
      {children}
    </label>
  )
}

function ScoreCell({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] tracking-wide text-[var(--color-muted)] uppercase">{label}</div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(value) }}>{value}</div>
      <div className="text-[10px] text-[var(--color-muted)]">{hint}</div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#b08d57'
  return (
    <label className="inline-flex flex-col items-center gap-1 text-[11px] text-[var(--color-muted)]">
      {label}
      <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-[var(--color-line)] bg-transparent p-0.5" />
    </label>
  )
}

function ManualHexAdd({ onAdd }: { onAdd: (hex: string) => void }) {
  const [v, setV] = useState('')
  const add = () => {
    const hex = v.trim().startsWith('#') ? v.trim() : '#' + v.trim()
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      onAdd(hex.toLowerCase())
      setV('')
    }
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="#hex manuell ergänzen" className="inp h-8 w-44 text-xs" />
      <button onClick={add} className="btn-ghost rounded-lg px-2.5 py-1 text-xs">Hinzufügen</button>
      <span className="text-[10px] text-[var(--color-muted)]">manuelle Farben haben höchste Priorität</span>
    </div>
  )
}

function CmpRow({ label, hexes }: { label: string; hexes: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[var(--color-muted)]">{label}</span>
      <div className="flex gap-1">
        {hexes.length ? hexes.map((h, i) => <span key={i} title={h} className="h-4 w-6 rounded border border-black/10" style={{ background: h }} />) : <span className="text-[var(--color-muted)]">—</span>}
      </div>
    </div>
  )
}

function Prof({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-xs tracking-wide text-[var(--color-muted)] uppercase">{label}</span>
      <span className={cls('text-sm', strong && 'font-semibold text-[var(--color-gold)]')}>{value}</span>
    </div>
  )
}

/* ─────────────────────────  KI-VORSCHAU-PANEL  ───────────────────────── */

const FORMAT_OPTIONS: { value: PreviewCodeFormat; label: string }[] = [
  { value: 'html', label: 'HTML/CSS' },
  { value: 'react-tailwind', label: 'React + Tailwind' },
  { value: 'nextjs', label: 'Next.js Component' },
  { value: 'lovable-prompt', label: 'Lovable Prompt' },
  { value: 'claude-code-prompt', label: 'Claude Code Prompt' },
  { value: 'v0-prompt', label: 'v0 Prompt' }
]

function download(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function AIPreviewPanel() {
  const { source, inspiration, result, projectId } = usePreviewStore()
  const toast = useToast((t) => t.show)
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [provider, setProvider] = useState<AIPreviewProvider>('manual')
  const [format, setFormat] = useState<PreviewCodeFormat>('html')
  const [aiTab, setAiTab] = useState<'preview' | 'prompt' | 'code' | 'analysis' | 'debug' | 'paste'>('prompt')
  const [prompt, setPrompt] = useState<AIPreviewPrompt | null>(null)
  const [manualExport, setManualExport] = useState('')
  const [editing, setEditing] = useState(false)
  const [editedUser, setEditedUser] = useState('')
  const [ai, setAi] = useState<AIPreviewResult | null>(null)
  const [busy, setBusy] = useState(false)
  // „KI-Code einfügen & prüfen“
  const [pasteCode, setPasteCode] = useState('')
  const [codeType, setCodeType] = useState<PreviewCodeFormat | 'auto'>('auto')
  const [pasteRes, setPasteRes] = useState<{ validation: PreviewValidation; correctionPrompt: string | null; renderableHtml?: string; format: PreviewCodeFormat } | null>(null)
  const [showPasteSandbox, setShowPasteSandbox] = useState(false)
  // Provider-Test
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // 1:1-Klon (B-HTML + A-Assets)
  const [cloneHtml, setCloneHtml] = useState('')
  const [cloneReport, setCloneReport] = useState<{ swappedImages: number; swappedBackgrounds: number; logoSwapped: boolean; colorMap: { from: string; to: string }[]; externalSheets: number; notes: string[] } | null>(null)

  useEffect(() => {
    getJson<{ ok: boolean; status: ProviderStatus }>('/api/ai-preview/providers')
      .then((d) => {
        if (d.status) {
          setStatus(d.status)
          setProvider(d.status.default)
        }
      })
      .catch(() => {})
  }, [])

  if (!result) return null
  const reqBody = (extra?: Record<string, unknown>) => ({
    source,
    inspiration,
    result,
    provider,
    format,
    customPrompt: editing && editedUser ? editedUser : undefined,
    ...extra
  })

  const copy = async (text: string, msg = 'In Zwischenablage kopiert') => {
    try {
      await navigator.clipboard.writeText(text)
      toast(msg, 'success')
    } catch {
      toast('Kopieren nicht möglich', 'error')
    }
  }

  const loadPrompt = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/ai-preview/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reqBody()) })
      const d = await r.json()
      if (d.ok) {
        setPrompt(d.prompt)
        setManualExport(d.manualExport)
        setEditedUser(d.prompt.user)
        setAiTab('prompt')
      } else toast(d.error || 'Prompt-Fehler', 'error')
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/ai-preview/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reqBody()) })
      const d = await r.json()
      if (!d.ok) {
        toast(d.error || 'Generierung fehlgeschlagen', 'error')
        return
      }
      const res = d.result as AIPreviewResult
      setAi(res)
      setPrompt(res.prompt)
      setManualExport(res.manualExport || manualExport)
      setEditedUser(res.prompt.user)
      if (res.code?.renderableHtml) setAiTab('preview')
      else if (res.mode === 'manual') setAiTab('prompt')
      else setAiTab('code')
      if (res.mode === 'manual') toast(res.error ? 'Provider-Fehler – manueller Export erstellt' : 'Prompt erstellt (manueller Modus)', 'info')
      else toast(res.validation?.passed ? 'KI-Vorschau erstellt ✓' : `KI-Vorschau erstellt (Validierung ${res.validation?.score ?? '—'})`, res.validation?.passed ? 'success' : 'info')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    try {
      await fetch('/api/previews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${result.concept.companyName} – KI-Vorschau`,
          company: result.concept.companyName,
          inspirationSource: inspiration?.companyName || inspiration?.url || '—',
          projectId: projectId || undefined,
          result,
          aiPreview: ai || undefined
        })
      })
      toast('Im Projekt gespeichert', 'success')
    } catch {
      toast('Speichern fehlgeschlagen', 'error')
    }
  }

  // ── KI-Code einfügen & prüfen ──
  const checkPaste = async (openSandbox = false) => {
    if (!pasteCode.trim()) {
      toast('Bitte zuerst Code einfügen', 'error')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/ai-preview/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rawCode: pasteCode, result, source, inspiration, codeType })
      })
      const d = await r.json()
      if (!d.ok) {
        toast(d.error || 'Prüfung fehlgeschlagen', 'error')
        return
      }
      setPasteRes({ validation: d.validation, correctionPrompt: d.correctionPrompt, renderableHtml: d.renderableHtml, format: d.format })
      setShowPasteSandbox(openSandbox && !!d.renderableHtml)
      if (openSandbox && !d.renderableHtml) toast('Kein direkt renderbares HTML (React/Next) – siehe Bewertung/Code', 'info')
      else toast(d.validation?.passed ? `Code geprüft ✓ (${d.validation.score})` : `Code geprüft: ${d.validation.score}/100 – ${d.validation.failures.length} Abweichung(en)`, d.validation?.passed ? 'success' : 'info')
    } finally {
      setBusy(false)
    }
  }
  const savePaste = async () => {
    try {
      await fetch('/api/previews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${result.concept.companyName} – KI-Code (eingefügt)`,
          company: result.concept.companyName,
          inspirationSource: inspiration?.companyName || inspiration?.url || '—',
          projectId: projectId || undefined,
          result,
          aiPreview: {
            mode: 'manual', provider: 'manual', providerUsed: 'manual', format: pasteRes?.format || 'html',
            prompt: prompt || { system: '', user: '', blueprintSummary: '', legalNote: '', format: 'html', provider: 'manual' },
            code: { format: pasteRes?.format || 'html', code: pasteCode, language: 'html', renderableHtml: pasteRes?.renderableHtml },
            validation: pasteRes?.validation, corrections: 0, correctionPrompts: pasteRes?.correctionPrompt ? [pasteRes.correctionPrompt] : [],
            createdAt: new Date().toISOString(), notes: ['manuell eingefügter KI-Code']
          }
        })
      })
      toast('Im Projekt gespeichert', 'success')
    } catch {
      toast('Speichern fehlgeschlagen', 'error')
    }
  }

  const runTest = async () => {
    setTestMsg(null)
    setBusy(true)
    try {
      const r = await fetch('/api/ai-preview/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider }) })
      const d = await r.json()
      if (!d.ok) {
        setTestMsg({ ok: false, text: d.error || 'Test fehlgeschlagen' })
        return
      }
      setTestMsg({ ok: d.result.ok, text: d.result.message })
    } catch {
      setTestMsg({ ok: false, text: 'Test fehlgeschlagen (Netzwerkfehler).' })
    } finally {
      setBusy(false)
    }
  }

  const runClone = async () => {
    setBusy(true)
    setCloneHtml('')
    setCloneReport(null)
    try {
      const r = await fetch('/api/ai-preview/clone', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, inspiration, result }) })
      const d = await r.json()
      if (!d.ok) {
        toast(d.error || 'Klon fehlgeschlagen', 'error')
        return
      }
      setCloneHtml(d.html)
      setCloneReport(d.report)
      setAiTab('preview')
      toast(`1:1-Klon erstellt · ${d.report.swappedImages} Bilder, ${d.report.colorMap.length} Farben getauscht`, 'success')
    } catch {
      toast('Klon fehlgeschlagen (Netzwerk).', 'error')
    } finally {
      setBusy(false)
    }
  }

  const pcfg = status?.providers.find((p) => p.provider === provider)
  const isPromptFmt = format.endsWith('-prompt')

  return (
    <div className="card border-[var(--color-gold-soft)] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <Sparkles size={18} className="text-[var(--color-gold)]" /> KI-Vorschau
        </h3>
        <span className="rounded-full bg-[var(--color-paper-2)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
          Kunde A (Farben/Logo/Bilder/Inhalte) + Referenz B (nur Struktur/Stil)
        </span>
      </div>

      {/* Steuerleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          Provider
          <select value={provider} onChange={(e) => { setProvider(e.target.value as AIPreviewProvider); setTestMsg(null) }} className="inp h-9 w-44">
            {(status?.providers || [{ provider: 'manual', label: 'Manueller Export', available: true } as never]).map((p) => (
              <option key={p.provider} value={p.provider}>
                {p.label}{p.provider !== 'manual' && !p.available ? ' (kein Key)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          Ziel
          <select value={format} onChange={(e) => setFormat(e.target.value as PreviewCodeFormat)} className="inp h-9 w-48">
            {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <button onClick={runClone} disabled={busy} className="btn-ink inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" title="Lädt die Referenz-B-Seite und ersetzt Logo/Farben/Bilder durch Kunde A">
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <Layers size={15} />} 1:1-Klon von B (Assets von A)
        </button>
        <button onClick={generate} disabled={busy} className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />} KI-Vorschau generieren
        </button>
        <button onClick={loadPrompt} disabled={busy} className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm">
          <Eye size={14} /> Prompt vorher anzeigen
        </button>
        {ai && (
          <button onClick={generate} disabled={busy} className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm">
            <RefreshCw size={14} /> Neu generieren
          </button>
        )}
        <button onClick={runTest} disabled={busy} className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm">
          <Check size={14} /> Provider testen
        </button>
      </div>

      {/* Sichere Status-Anzeige: nur verfügbar / Key ja-nein / Modell – niemals der Key selbst */}
      {pcfg && (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Status: <b>{pcfg.available ? '✓ verfügbar' : '– nicht verfügbar'}</b> · Key: {pcfg.requiresKey ? (pcfg.hasKey ? 'vorhanden' : 'fehlt') : 'nicht nötig'} · Modell: {pcfg.model || '—'}
        </p>
      )}
      {testMsg && (
        <p className={cls('mt-1 text-xs', testMsg.ok ? 'text-green-600' : 'text-amber-600')}>{testMsg.ok ? '✓ ' : '⚠ '}{testMsg.text}</p>
      )}
      {pcfg?.note && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {pcfg.provider !== 'manual' && !pcfg.available ? '⚠️ ' : 'ℹ️ '}{pcfg.note}
        </p>
      )}
      {provider === 'ollama' && (
        <p className="mt-1 text-xs text-amber-600">Lokale Modelle können schwächere Designs erzeugen als spezialisierte UI-KIs.</p>
      )}

      {result && (
        <>
          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-1 border-b border-[var(--color-line)]">
            {([
              ['preview', 'Vorschau'],
              ['prompt', 'Prompt'],
              ['code', 'Code'],
              ['paste', 'Code einfügen'],
              ['analysis', 'Analyse'],
              ['debug', 'Debug']
            ] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setAiTab(k)}
                className={cls('rounded-t-lg px-3 py-1.5 text-sm', aiTab === k ? 'border-b-2 border-[var(--color-gold)] font-medium text-[var(--color-ink)]' : 'text-[var(--color-muted)]')}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {/* Vorschau */}
            {aiTab === 'preview' && (
              cloneHtml ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                    <span className="rounded-full bg-[var(--color-gold-soft)] px-2 py-0.5 font-medium text-[var(--color-ink)]">1:1-Klon von B</span>
                    {cloneReport && <span>· {cloneReport.swappedImages} Bilder · {cloneReport.swappedBackgrounds} Hintergründe · Logo {cloneReport.logoSwapped ? '✓' : '—'} · {cloneReport.colorMap.length} Farben getauscht</span>}
                    <button onClick={() => download('klon-vorschau.html', cloneHtml, 'text/html')} className="btn-ghost inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs"><FileCode size={12} /> HTML exportieren</button>
                  </div>
                  <iframe
                    title="1:1-Klon von B mit A-Assets"
                    sandbox="allow-same-origin"
                    className="h-[620px] w-full rounded-lg border border-[var(--color-line)] bg-white"
                    srcDoc={cloneHtml}
                  />
                  {cloneReport && cloneReport.notes.length > 0 && (
                    <p className="text-xs text-amber-600">{cloneReport.notes.join(' · ')}</p>
                  )}
                </div>
              ) : ai?.code?.renderableHtml ? (
                <iframe
                  title="KI-Vorschau"
                  sandbox="allow-same-origin"
                  className="h-[560px] w-full rounded-lg border border-[var(--color-line)] bg-white"
                  srcDoc={ai.code.renderableHtml}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-[var(--color-line)] p-8 text-center">
                  <p className="text-sm text-[var(--color-muted)]">Noch keine Vorschau erzeugt. Wähle eine Variante:</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button onClick={runClone} disabled={busy} className="btn-ink inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium">
                      {busy ? <RefreshCw size={15} className="animate-spin" /> : <Layers size={15} />} 1:1-Klon von B (Assets von A)
                    </button>
                    <button onClick={generate} disabled={busy} className="btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium">
                      {busy ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />} KI-Vorschau generieren
                    </button>
                  </div>
                  <p className="max-w-md text-xs text-[var(--color-muted)]">
                    <b>1:1-Klon:</b> lädt das Layout von Referenz B und setzt Logo/Farben/Bilder von Kunde A ein (kein API-Key nötig).<br />
                    <b>KI-Vorschau:</b> lässt die KI (OpenAI) eine eigene Umsetzung im Stil von B bauen.
                  </p>
                  {ai?.mode === 'manual' && !isPromptFmt && (
                    <p className="text-xs text-amber-600">Zuvor lief der manuelle Modus. Für Live-Code ist jetzt „OpenAI“ als Provider gewählt – einfach „KI-Vorschau generieren“ klicken.</p>
                  )}
                  {format !== 'html' && !isPromptFmt && <p className="text-xs text-[var(--color-muted)]">Hinweis: Ziel „{FORMAT_OPTIONS.find((o) => o.value === format)?.label}“ wird nicht direkt gerendert – Ergebnis im Tab „Code“.</p>}
                </div>
              )
            )}

            {/* Prompt */}
            {aiTab === 'prompt' && prompt && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setEditing((v) => !v)} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Pencil size={13} /> {editing ? 'Bearbeitung aus' : 'Prompt bearbeiten'}</button>
                  <button onClick={() => copy(manualExport || `${prompt.system}\n\n${editing ? editedUser : prompt.user}`, 'Prompt kopiert')} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Copy size={13} /> Prompt kopieren</button>
                  <button onClick={() => download('ki-prompt.txt', manualExport || `${prompt.system}\n\n${prompt.user}`)} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Download size={13} /> Als .txt speichern</button>
                </div>
                <div className="rounded-lg bg-[var(--color-paper-2)]/60 p-3 text-xs">
                  <div className="mb-1 font-semibold text-[var(--color-muted)]">System</div>
                  <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{prompt.system}</p>
                </div>
                {editing ? (
                  <textarea value={editedUser} onChange={(e) => setEditedUser(e.target.value)} className="inp h-64 w-full font-mono text-[11px]" />
                ) : (
                  <div className="rounded-lg bg-[var(--color-paper-2)]/60 p-3">
                    <div className="mb-1 text-xs font-semibold text-[var(--color-muted)]">Aufgabe (automatisch erzeugt)</div>
                    <p className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{prompt.user}</p>
                  </div>
                )}
              </div>
            )}

            {/* Code */}
            {aiTab === 'code' && (
              ai?.code ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copy(ai.code!.code, 'Code kopiert')} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Copy size={13} /> Code kopieren</button>
                    <button onClick={() => download(format === 'html' ? 'vorschau.html' : format === 'nextjs' ? 'Preview.tsx' : 'Preview.jsx', ai.code!.code, format === 'html' ? 'text/html' : 'text/plain')} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><FileCode size={13} /> {format === 'html' ? 'Als HTML exportieren' : 'Als React exportieren'}</button>
                    <button onClick={save} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Save size={13} /> Im Projekt speichern</button>
                  </div>
                  <pre className="max-h-[520px] overflow-auto rounded-lg bg-[#1a1712] p-3 text-[11px] leading-relaxed text-[#f3ece1]"><code>{ai.code.code}</code></pre>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">Noch kein Code. Provider mit API-Key wählen und generieren, oder „manuell“ → Prompt-Tab.</div>
              )
            )}

            {/* Code einfügen (manueller KI-Workflow) */}
            {aiTab === 'paste' && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--color-muted)]">
                  1) Prompt kopieren (Tab „Prompt“) → 2) in Claude Code / Lovable / v0 einfügen → 3) erzeugten Code hier einfügen → 4) prüfen &amp; sandboxed ansehen.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                    Code-Typ
                    <select value={codeType} onChange={(e) => setCodeType(e.target.value as PreviewCodeFormat | 'auto')} className="inp h-9 w-48">
                      <option value="auto">unbekannt / automatisch erkennen</option>
                      <option value="html">HTML/CSS</option>
                      <option value="react-tailwind">React/Tailwind</option>
                      <option value="nextjs">Next.js Component</option>
                    </select>
                  </label>
                </div>
                <textarea
                  value={pasteCode}
                  onChange={(e) => setPasteCode(e.target.value)}
                  placeholder="Hier den von der externen KI erzeugten HTML/React-Code einfügen …"
                  className="inp h-56 w-full font-mono text-[11px]"
                />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => checkPaste(false)} disabled={busy} className="btn-ink inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Check size={13} /> Code prüfen</button>
                  <button onClick={() => checkPaste(true)} disabled={busy} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Eye size={13} /> Sandbox-Vorschau anzeigen</button>
                  <button onClick={() => copy(pasteRes?.correctionPrompt || '', 'Korrekturprompt kopiert')} disabled={!pasteRes?.correctionPrompt} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-40"><RefreshCw size={13} /> Korrekturprompt erstellen</button>
                  <button onClick={savePaste} disabled={!pasteRes} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-40"><Save size={13} /> Im Projekt speichern</button>
                  <button onClick={() => download('vorschau.html', pasteRes?.renderableHtml || pasteCode, 'text/html')} disabled={!pasteCode} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-40"><FileCode size={13} /> Als HTML exportieren</button>
                </div>

                {showPasteSandbox && pasteRes?.renderableHtml && (
                  <iframe
                    title="Sandbox-Vorschau (eingefügter Code)"
                    sandbox="allow-same-origin"
                    className="h-[560px] w-full rounded-lg border border-[var(--color-line)] bg-white"
                    srcDoc={pasteRes.renderableHtml}
                  />
                )}

                {pasteRes && (
                  <div className="space-y-2 rounded-lg border border-[var(--color-line)] p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Bewertung:</span>
                      <b style={{ color: scoreColor(pasteRes.validation.score) }}>{pasteRes.validation.score}/100</b>
                      <span className={cls('rounded-full px-2 py-0.5 text-xs', pasteRes.validation.passed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>{pasteRes.validation.passed ? 'kundentauglich' : 'nicht ausreichend'}</span>
                      <span className="text-xs text-[var(--color-muted)]">· erkannt als {pasteRes.format}</span>
                    </div>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {pasteRes.validation.checks.map((c) => (
                        <li key={c.id} className="flex items-start gap-2 text-xs">
                          <span className={c.pass ? 'text-green-600' : 'text-red-500'}>{c.pass ? '✓' : '✗'}</span>
                          <span><b>{c.label}</b>{c.detail ? ` — ${c.detail}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                    {pasteRes.validation.details && (
                      <div className="rounded-lg bg-[var(--color-paper-2)]/50 p-2 font-mono text-[11px] text-[var(--color-ink-soft)]">
                        <div>Verwendete Kunde-A-Farben: {pasteRes.validation.details.usedColors.join(', ') || '—'}</div>
                        <div>Kunde-A-Bilder genutzt: {pasteRes.validation.details.usedCustomerImages.length} · fehlend: {pasteRes.validation.details.missingCustomerImages.length}</div>
                        <div>Referenz-B-Farben gefunden: {pasteRes.validation.details.referenceColorsFound.join(', ') || 'keine'}</div>
                        <div>Referenz-B-Bilder gefunden: {pasteRes.validation.details.referenceImagesFound.join(', ') || 'keine'}</div>
                        <div>Sicherheit: {pasteRes.validation.details.securityIssues.length ? '⚠ ' + pasteRes.validation.details.securityIssues.join('; ') : 'ok (keine Scripts/Events)'}</div>
                        <div>{'<img>'} im Code: {pasteRes.validation.details.imageCountInCode}</div>
                      </div>
                    )}
                    {!pasteRes.validation.passed && pasteRes.correctionPrompt && (
                      <div>
                        <div className="mb-1 text-xs font-semibold text-[var(--color-muted)]">Automatischer Korrekturprompt (kopieren &amp; erneut an die KI geben):</div>
                        <p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-paper-2)]/50 p-2 font-mono text-[11px]">{pasteRes.correctionPrompt}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Analyse */}
            {aiTab === 'analysis' && (
              ai?.validation ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Validierung:</span>
                    <b style={{ color: scoreColor(ai.validation.score) }}>{ai.validation.score}/100</b>
                    <span className={cls('rounded-full px-2 py-0.5 text-xs', ai.validation.passed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>{ai.validation.passed ? 'bestanden' : 'Abweichungen'}</span>
                    {ai.corrections > 0 && <span className="text-xs text-[var(--color-muted)]">· {ai.corrections} Korrekturrunde(n)</span>}
                  </div>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {ai.validation.checks.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-xs">
                        <span className={c.pass ? 'text-green-600' : 'text-red-500'}>{c.pass ? '✓' : '✗'}</span>
                        <span><b>{c.label}</b>{c.detail ? ` — ${c.detail}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                  {!ai.validation.passed && (
                    <button onClick={generate} disabled={busy} className="btn-ink mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><RefreshCw size={13} /> Mit Korrektur neu generieren</button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">Keine Validierung (manueller Modus oder noch nicht generiert).</div>
              )
            )}

            {/* Debug */}
            {aiTab === 'debug' && (
              <div className="rounded-lg bg-[var(--color-paper-2)]/50 p-3 font-mono text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
                <div className="mb-1 flex items-center gap-1"><Bug size={12} /> Provider-Status</div>
                {(status?.providers || []).map((p) => (
                  <div key={p.provider}>· {p.label}: {p.available ? 'verfügbar' : 'kein Key'}{p.model ? ` · ${p.model}` : ''}{p.provider === status?.default ? ' · [Standard]' : ''}</div>
                ))}
                {ai && (
                  <>
                    <div className="mt-2 border-t border-[var(--color-line)] pt-1">Modus: {ai.mode} · Provider: {ai.provider} → genutzt: {ai.providerUsed} · Format: {ai.format} · Korrekturrunden: {ai.corrections}</div>
                    {ai.error && <div className="text-red-500">Fehler: {ai.error}</div>}
                    {ai.notes.map((n, i) => <div key={i}>» {n}</div>)}
                    {ai.correctionPrompts.map((c, i) => <div key={'c' + i} className="mt-1 whitespace-pre-wrap">Korrektur {i + 1}: {c.slice(0, 300)}</div>)}
                  </>
                )}
                {prompt && <div className="mt-2 border-t border-[var(--color-line)] pt-1 whitespace-pre-wrap">Blueprint-Zusammenfassung: {prompt.blueprintSummary}</div>}
              </div>
            )}
          </div>
        </>
      )}

      <p className="mt-3 text-[11px] text-[var(--color-muted)]">
        Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos, Texte, Codes oder exakten Layouts 1:1 kopieren. Generierter Code wird sandboxed und ohne fremde Skripte angezeigt.
      </p>
    </div>
  )
}
