'use client'
import { useEffect, useState } from 'react'
import { Wand2, Sparkles, Link as LinkIcon, Copy, Download, Save, Check, X, FileText, Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/ui/Ui'
import type { SavedPrompt, CompetitorAnalysis, InspirationSearchProject, AnalysisProject } from '@shared/types'
import { usePromptStore } from '@/lib/stores/promptStore'
import { useToast } from '@/lib/stores/toastStore'
import { refFromUrl, refFromCompetitor } from '@/lib/promptRef'
import { getJson } from '@/lib/client'
import { PROMPT_TYPES, PLATFORMS } from '@/lib/categories'
import { ColorSwatches } from '@/components/ui/Bits'
import { shotUrl, cls } from '@/lib/format'
import type { ProjectSummary } from '@/server/services/storage'

export default function PromptGeneratorPage() {
  const s = usePromptStore()
  const [tab, setTab] = useState<'gen' | 'saved'>('gen')
  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <PageHeader
        eyebrow="Werkzeuge"
        icon={Wand2}
        title="Prompt Generator"
        subtitle="Aus einer Inspirations-Website einen hochwertigen deutschen Prompt für ein neues Kundenprojekt erstellen – für Claude Code, Lovable, Cursor & Co."
      />

      <div className="flex gap-2">
        <button onClick={() => setTab('gen')} className={cls('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium', tab === 'gen' ? 'btn-ink' : 'btn-ghost')}>
          <Wand2 size={15} /> Generator
        </button>
        <button onClick={() => setTab('saved')} className={cls('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium', tab === 'saved' ? 'btn-ink' : 'btn-ghost')}>
          <FileText size={15} /> Gespeicherte Prompts
        </button>
      </div>

      {tab === 'gen' ? <Generator s={s} /> : <SavedList />}
    </div>
  )
}

/* ───────────────────────── Generator ───────────────────────── */
function Generator({ s }: { s: ReturnType<typeof usePromptStore> }) {
  return (
    <div className="space-y-4">
      <Step n={1} title="Inspirations-Website (Vorlage A)">
        <InspirationStep />
      </Step>
      <Step n={2} title="Zielunternehmen (B)">
        <TargetStep />
      </Step>
      <Step n={3} title="Prompt-Typ & Zielplattform">
        <TypePlatformStep />
      </Step>
      <Step n={4} title="Prompt erzeugen">
        <GenerateStep />
      </Step>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-ink)] text-xs font-semibold text-[var(--color-paper)]">{n}</span>
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function InspirationStep() {
  const { inspiration, setInspiration, clearInspiration } = usePromptStore()
  const [url, setUrl] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  if (inspiration) {
    const shot = shotUrl(inspiration.screenshot)
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {shot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="" className="h-20 w-32 shrink-0 rounded-lg border border-[var(--color-line)] object-cover object-top" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium">{inspiration.companyName || inspiration.url}</div>
          <div className="truncate text-xs text-[var(--color-muted)]">
            {inspiration.url} · Stil: {inspiration.designStyle || '—'}
            {inspiration.score != null && ` · Score ${inspiration.score}`}
            {!inspiration.fromAnalysis && ' · nur manuell (nicht analysiert)'}
          </div>
          <div className="mt-1"><ColorSwatches colors={inspiration.colors.map((hex) => ({ hex }))} /></div>
        </div>
        <button onClick={clearInspiration} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
          <X size={14} /> Ändern
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Wähle eine Website über die Buttons „Prompt erstellen“ in Inspiration-Suche oder URL-Analyse – oder füge hier manuell eine URL ein.
      </p>
      <div className="flex gap-2">
        <input className="inp flex-1" placeholder="https://referenz-website.de" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button onClick={() => url.trim() && setInspiration(refFromUrl(url.trim()))} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
          <LinkIcon size={14} /> Übernehmen
        </button>
      </div>
      <button onClick={() => setShowPicker((v) => !v)} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gold)] hover:underline">
        <Sparkles size={14} /> Aus gespeicherten Reports wählen
      </button>
      {showPicker && <ReportPicker onPick={(c) => setInspiration(refFromCompetitor(c))} />}
    </div>
  )
}

function ReportPicker({ onPick }: { onPick: (c: CompetitorAnalysis) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [results, setResults] = useState<CompetitorAnalysis[] | null>(null)
  useEffect(() => {
    getJson<ProjectSummary[]>('/api/projects').then(setProjects).catch(() => {})
  }, [])
  const loadProject = async (id: string) => {
    const p = await getJson<AnalysisProject | InspirationSearchProject>(`/api/projects/${id}`)
    setResults('results' in p ? p.results : p.competitors)
  }
  return (
    <div className="rounded-xl border border-[var(--color-line)] p-3">
      {!results ? (
        projects.length === 0 ? (
          <div className="text-xs text-[var(--color-muted)]">Noch keine gespeicherten Reports.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <button key={p.id} onClick={() => loadProject(p.id)} className="chip rounded-lg px-3 py-1.5 text-xs">
                {p.title} ({p.resultCount})
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setResults(null)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">← zurück</button>
          {results.map((c) => (
            <button key={c.id} onClick={() => onPick(c)} className="chip rounded-lg px-3 py-1.5 text-xs">
              {c.snapshot.companyName || c.snapshot.domain} · {c.score.total}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TargetStep() {
  const { target, setTarget, analyzeTargetUrl, setField } = usePromptStore()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <F label="Firmenname"><input className="inp" value={target.companyName} onChange={(e) => setTarget({ companyName: e.target.value })} placeholder="z. B. Restaurant Leon" /></F>
      <F label="Website-URL (falls vorhanden)"><input className="inp" value={target.url} onChange={(e) => setTarget({ url: e.target.value })} placeholder="https://…" /></F>
      <F label="Branche"><input className="inp" value={target.industry} onChange={(e) => setTarget({ industry: e.target.value })} /></F>
      <F label="Standort"><input className="inp" value={target.location} onChange={(e) => setTarget({ location: e.target.value })} placeholder="z. B. Köln" /></F>
      <F label="Leistungen / Angebot"><input className="inp" value={target.services} onChange={(e) => setTarget({ services: e.target.value })} placeholder="kommagetrennt" /></F>
      <F label="Zielgruppe"><input className="inp" value={target.targetGroup} onChange={(e) => setTarget({ targetGroup: e.target.value })} /></F>
      <F label="Ziel der Website"><input className="inp" value={target.goal} onChange={(e) => setTarget({ goal: e.target.value })} placeholder="z. B. mehr Reservierungen" /></F>
      <F label="Gewünschte Seiten (kommagetrennt)"><input className="inp" value={(target.preferredPages || []).join(', ')} onChange={(e) => setTarget({ preferredPages: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></F>
      <div className="sm:col-span-2">
        <F label="Notizen / Wünsche"><textarea className="inp h-20 py-2" value={target.notes} onChange={(e) => setTarget({ notes: e.target.value })} /></F>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        <input type="checkbox" checked={!!target.hasLogo} onChange={(e) => setTarget({ hasLogo: e.target.checked })} /> Logo/Assets vorhanden
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        <input type="checkbox" checked={analyzeTargetUrl} onChange={(e) => setField({ analyzeTargetUrl: e.target.checked })} /> Bestehende Website analysieren (falls URL)
      </label>
    </div>
  )
}

function TypePlatformStep() {
  const { promptType, platform, setField } = usePromptStore()
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">Prompt-Typ</div>
        <div className="flex flex-wrap gap-2">
          {PROMPT_TYPES.map((t) => (
            <button key={t.value} onClick={() => setField({ promptType: t.value })} className={cls('chip rounded-xl px-3.5 py-2 text-left text-sm', promptType === t.value && 'chip-active')} title={t.desc}>
              <div className="font-medium">{t.label}</div>
              <div className={cls('text-[11px]', promptType === t.value ? 'text-[var(--color-paper)]/70' : 'text-[var(--color-muted)]')}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <F label="Zielplattform">
        <select value={platform} onChange={(e) => setField({ platform: e.target.value as typeof platform })} className="inp max-w-xs">
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </F>
    </div>
  )
}

function GenerateStep() {
  const { inspiration, generating, result, editedPrompt, error, saved, generate, savePrompt, setField } = usePromptStore()
  const [copied, setCopied] = useState(false)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const { projectId } = usePromptStore()
  const toast = useToast((s) => s.show)

  useEffect(() => {
    getJson<ProjectSummary[]>('/api/projects').then(setProjects).catch(() => {})
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(editedPrompt)
    setCopied(true)
    toast('Prompt in die Zwischenablage kopiert', 'success')
    setTimeout(() => setCopied(false), 1500)
  }
  const download = () => {
    const blob = new Blob([editedPrompt], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'prompt.txt'
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Prompt als .txt gespeichert', 'success')
  }
  const openIn = async (url: string, name: string) => {
    await navigator.clipboard.writeText(editedPrompt)
    toast(`Prompt kopiert – in ${name} einfügen (Strg+V)`, 'success')
    window.open(url, '_blank', 'noopener')
  }
  const LAUNCH: { name: string; url: string }[] = [
    { name: 'Claude', url: 'https://claude.ai/new' },
    { name: 'Lovable', url: 'https://lovable.dev/' },
    { name: 'ChatGPT', url: 'https://chatgpt.com/' },
    { name: 'Cursor', url: 'https://www.cursor.com/' }
  ]
  const onSave = async () => {
    try {
      const p = await savePrompt()
      if (p) toast(projectId ? 'Prompt im Projekt gespeichert ✓' : 'Prompt gespeichert ✓', 'success')
      else toast('Speichern fehlgeschlagen', 'error')
    } catch {
      toast('Speichern fehlgeschlagen', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={generate} disabled={generating || !inspiration} className="btn-ink inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium">
          {generating ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />} {generating ? 'Erzeuge Prompt …' : 'Prompt erzeugen'}
        </button>
        {!inspiration && <span className="text-sm text-[var(--color-muted)]">Bitte zuerst Schritt 1 (Vorlage) wählen.</span>}
      </div>

      {error && <div className="rounded-lg border border-red-300/60 bg-red-50/60 p-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Zusammenfassung */}
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)]/40 p-4 text-sm">
            <div className="mb-2 font-semibold">Zusammenfassung</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div><b>Inspiration:</b> {result.summary.inspirationSource}</div>
              <div><b>Zielunternehmen:</b> {result.summary.targetCompany}</div>
              <div><b>Stilrichtung:</b> {result.summary.styleDirection}</div>
              <div><b>Haupt-CTA:</b> {result.summary.mainCta}</div>
              <div className="sm:col-span-2"><b>Empfohlene Seiten:</b> {result.summary.recommendedPages.join(' · ')}</div>
            </div>
            <div className="mt-2 rounded-lg border border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 p-2 text-xs text-[var(--color-ink-soft)]">
              {result.summary.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
            </div>
            {result.meta.aiUsed && <div className="mt-2 text-xs text-[var(--color-gold)]">✨ KI-veredelt</div>}
            {result.targetAnalysis?.reachable && (
              <div className="mt-2 text-xs text-[var(--color-muted)]">
                Bestehende Website analysiert: {result.targetAnalysis.weaknesses.length} Schwächen, {result.targetAnalysis.strengths.length} Stärken einbezogen.
              </div>
            )}
          </div>

          {/* editierbarer Prompt */}
          <div>
            <div className="mb-1.5 text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">Prompt (bearbeitbar)</div>
            <textarea
              value={editedPrompt}
              onChange={(e) => setField({ editedPrompt: e.target.value })}
              className="h-[420px] w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-[var(--color-gold)]"
            />
          </div>

          {/* Aktionen */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copy} className="btn-ink inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Kopiert' : 'Prompt kopieren'}
            </button>
            <button onClick={download} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm">
              <Download size={15} /> Als .txt speichern
            </button>
            <div className="ml-auto flex items-center gap-2">
              {projects.length > 0 && (
                <select value={projectId} onChange={(e) => setField({ projectId: e.target.value })} className="inp w-44">
                  <option value="">keinem Projekt</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              )}
              <button onClick={onSave} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm">
                {saved ? <Check size={15} /> : <Save size={15} />} {saved ? 'Gespeichert' : 'Im Projekt speichern'}
              </button>
            </div>
          </div>

          {/* Direkt testen: kopiert den Prompt und öffnet das KI-Tool */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3">
            <span className="text-sm text-[var(--color-muted)]">Kopieren &amp; direkt testen in:</span>
            {LAUNCH.map((l) => (
              <button key={l.name} onClick={() => openIn(l.url, l.name)} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm">
                {l.name} <ExternalLink size={13} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</span>
      {children}
    </label>
  )
}

/* ───────────────────────── Gespeicherte Prompts ───────────────────────── */
function SavedList() {
  const [list, setList] = useState<SavedPrompt[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const refresh = () => getJson<SavedPrompt[]>('/api/prompts').then(setList).catch(() => {})
  useEffect(() => { refresh() }, [])

  const del = async (id: string) => { await fetch(`/api/prompts/${id}`, { method: 'DELETE' }); refresh() }
  const copy = (t: string) => navigator.clipboard.writeText(t)
  const download = (p: SavedPrompt) => {
    const blob = new Blob([p.promptText], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${p.targetCompany.replace(/[^a-z0-9]/gi, '_')}_prompt.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (list.length === 0) return <div className="card p-6 text-sm text-[var(--color-muted)]">Noch keine gespeicherten Prompts.</div>

  return (
    <div className="space-y-3">
      {list.map((p) => (
        <div key={p.id} className="card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-paper-2)] text-[var(--color-gold)]"><Wand2 size={17} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.title}</div>
              <div className="truncate text-xs text-[var(--color-muted)]">
                Ziel: {p.targetCompany} · Vorlage: {p.inspirationSource} · {p.platform} · {new Date(p.createdAt).toLocaleString('de-DE')}
              </div>
            </div>
            <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">{openId === p.id ? 'schließen' : 'ansehen'}</button>
            <button onClick={() => copy(p.promptText)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg" title="Kopieren"><Copy size={14} /></button>
            <button onClick={() => download(p)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg" title="Download"><Download size={14} /></button>
            <button onClick={() => del(p.id)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:text-red-600" title="Löschen"><Trash2 size={14} /></button>
          </div>
          {openId === p.id && (
            <pre className="mt-3 max-h-96 overflow-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)]/40 p-3 font-mono text-[12px] whitespace-pre-wrap">{p.promptText}</pre>
          )}
        </div>
      ))}
    </div>
  )
}
