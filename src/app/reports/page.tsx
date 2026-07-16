'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Link2, Trash2, ArrowLeft, Clock, Wand2, Eye, FileText } from 'lucide-react'
import { PageHeader } from '@/components/ui/Ui'
import { getJson } from '@/lib/client'
import { ResultsBlock } from '@/components/ResultsBlock'
import { RelatedPrompts } from '@/components/RelatedPrompts'
import { usePreviewStore } from '@/lib/stores/previewStore'
import type { ProjectSummary } from '@/server/services/storage'
import type { AnalysisProject, InspirationSearchProject, SavedPrompt } from '@shared/types'

type AnyProject = AnalysisProject | InspirationSearchProject
const isSearch = (p: AnyProject): p is InspirationSearchProject => (p as InspirationSearchProject).mode === 'search'

export default function ReportsPage() {
  const [list, setList] = useState<ProjectSummary[]>([])
  const [open, setOpen] = useState<AnyProject | null>(null)
  const [loading, setLoading] = useState(false)
  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({})
  const router = useRouter()

  const refresh = () => getJson<ProjectSummary[]>('/api/projects').then(setList).catch(() => {})
  const refreshCounts = () =>
    getJson<SavedPrompt[]>('/api/prompts')
      .then((all) => {
        const m: Record<string, number> = {}
        for (const p of all) if (p.projectId) m[p.projectId] = (m[p.projectId] || 0) + 1
        setPromptCounts(m)
      })
      .catch(() => {})
  useEffect(() => {
    refresh()
    refreshCounts()
    const id = new URLSearchParams(window.location.search).get('open')
    if (id) loadProject(id)
  }, [])

  const loadProject = async (id: string) => {
    setLoading(true)
    try {
      setOpen(await getJson<AnyProject>(`/api/projects/${id}`))
      window.scrollTo({ top: 0 })
    } finally {
      setLoading(false)
    }
  }

  const del = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (open && open.id === id) setOpen(null)
    refresh()
  }

  const startPreview = () => {
    if (open && !isSearch(open) && open.target) usePreviewStore.getState().setSourceFromTarget(open.target)
    router.push('/design-preview')
  }

  if (open) {
    const results = isSearch(open) ? open.results : open.competitors
    const title = isSearch(open) ? open.config.query || open.detected.industry || 'Inspiration-Suche' : open.target.companyName || open.target.domain
    return (
      <div className="mx-auto max-w-[1440px] space-y-5">
        <button onClick={() => setOpen(null)} className="btn-ghost inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
          <ArrowLeft size={15} /> Zurück zur Liste
        </button>
        <PageHeader
          eyebrow={isSearch(open) ? 'Inspiration-Suche' : 'Kundenanalyse'}
          title={title}
          subtitle={`${results.length} analysierte Website${results.length === 1 ? '' : 's'}`}
          action={
            <button onClick={startPreview} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
              <Eye size={15} /> Design-Vorschau erstellen
            </button>
          }
        />
        <ResultsBlock
          results={results}
          report={open.report}
          projectId={open.id}
          learnLabel={isSearch(open) ? 'Was LL Studio lernen kann' : 'Fehler der Zielseite vs. Mitbewerber'}
        />
        <RelatedPrompts projectId={open.id} projectTitle={title} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <PageHeader
        eyebrow="Archiv"
        icon={FileText}
        title="Reports"
        subtitle="Alle gespeicherten Analysen und Inspirations-Suchen als abgeschlossene Arbeitsdokumente."
      />

      {loading && <div className="card p-4 text-sm text-[var(--color-muted)]">lädt …</div>}

      {list.length === 0 ? (
        <div className="card p-6 text-sm text-[var(--color-muted)]">Noch keine gespeicherten Reports.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <div key={p.id} className="card flex items-center gap-3 p-4">
              <button onClick={() => loadProject(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-paper-2)] text-[var(--color-gold)]">
                  {p.mode === 'search' ? <Sparkles size={17} /> : <Link2 size={17} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="truncate text-xs text-[var(--color-muted)]">{p.subtitle || '—'} · {p.resultCount} Webseiten</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(p.createdAt).toLocaleString('de-DE')}</span>
                    <span>· Top {p.topScore}</span>
                    {promptCounts[p.id] > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-gold)]">
                        <Wand2 size={9} /> {promptCounts[p.id]} Prompt{promptCounts[p.id] > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <button onClick={() => del(p.id)} className="btn-ghost grid h-9 w-9 place-items-center rounded-lg text-[var(--color-muted)] hover:text-red-600" title="Löschen">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
