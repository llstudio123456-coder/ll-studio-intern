'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FolderKanban, Plus, Search, Lock, Building2, MessageSquare, HardDrive } from 'lucide-react'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui/Ui'
import { ProjectEditor } from '@/components/workspace/ProjectEditor'
import { PROJECT_KIND_LABELS, PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from '@shared/projects'

interface Data {
  projects: Project[]
  users: { id: string; name?: string; email: string }[]
  companies: { id: string; name: string }[]
  me: { id: string; role: string }
}

const STATUS_TONE: Partial<Record<ProjectStatus, string>> = {
  aktiv: 'bg-emerald-50 text-emerald-700',
  geplant: 'bg-amber-50 text-amber-700',
  vorbereitung: 'bg-amber-50 text-amber-700',
  wartet_kunde: 'bg-blue-50 text-blue-700',
  pruefung: 'bg-blue-50 text-blue-700',
  abgebrochen: 'bg-red-50 text-red-700'
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  )
}

function ProjectsInner() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') || ''

  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState(q)

  const load = useCallback(async () => {
    setError('')
    try {
      const u = new URLSearchParams()
      if (q) u.set('q', q)
      const r = await fetch(`/api/workspace/projects?${u}`)
      const d = await r.json()
      if (!r.ok) { setError(d?.error || 'Die Projekte konnten nicht geladen werden.'); return }
      setData(d)
    } catch {
      setError('Die Projekte konnten nicht geladen werden.')
    }
  }, [q])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => {
      if (search === q) return
      const u = new URLSearchParams(params.toString())
      if (search) u.set('q', search); else u.delete('q')
      router.replace(`/workspace/projekte?${u}`)
    }, 300)
    return () => clearTimeout(t)
  }, [search, q, params, router])

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        eyebrow="Workspace"
        icon={FolderKanban}
        title="Projekte"
        subtitle={data ? `${data.projects.length} Projekt${data.projects.length === 1 ? '' : 'e'}` : 'Wird geladen …'}
        action={
          <button onClick={() => setCreating(true)} className="btn-ink flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <Plus size={14} /> Neues Projekt
          </button>
        }
      />

      <div className="mt-4">
        <div className="relative">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Projekte durchsuchen …" className="inp pl-9" aria-label="Projekte durchsuchen" />
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {!data && <div className="sm:col-span-2 xl:col-span-3"><SkeletonRows rows={3} /></div>}
        {data?.projects.length === 0 && (
          <div className="sm:col-span-2 xl:col-span-3">
            <EmptyState icon={FolderKanban} title={q ? 'Keine Treffer' : 'Noch keine Projekte'} description={q ? 'Andere Suche probieren.' : 'Bündle Kunde, Aufgaben, Chat und Dateien in einem Projekt.'} />
          </div>
        )}
        {data?.projects.map((p) => (
          <button key={p.id} onClick={() => router.push(`/workspace/projekte/${p.id}`)} className="card flex flex-col p-4 text-left transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 truncate font-medium text-[var(--color-ink)]">{p.name}</h3>
              {p.visibility === 'private' && <Lock size={13} className="mt-0.5 shrink-0 text-[var(--color-muted)]" aria-label="Privat" />}
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{PROJECT_KIND_LABELS[p.kind]}</p>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                <span>{p.taskDone ?? 0}/{p.taskCount ?? 0} Aufgaben</span>
                <span className="tabular-nums">{p.progress ?? 0} %</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-paper-2)]">
                <div className="h-full rounded-full bg-[var(--color-gold)] transition-all" style={{ width: `${p.progress ?? 0}%` }} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line)] pt-2.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[p.status] || 'bg-[var(--color-paper-2)] text-[var(--color-muted)]'}`}>{PROJECT_STATUS_LABELS[p.status]}</span>
              {p.companyName && <span className="flex items-center gap-1 text-[11px] text-[var(--color-gold)]"><Building2 size={10} /> {p.companyName}</span>}
              {p.chatChannelId && <MessageSquare size={11} className="text-[var(--color-muted)]" aria-label="Projektchat" />}
              {p.folderId && <HardDrive size={11} className="text-[var(--color-muted)]" aria-label="Projektordner" />}
            </div>
          </button>
        ))}
      </div>

      {creating && data && (
        <ProjectEditor users={data.users} companies={data.companies} meId={data.me.id}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); router.push(`/workspace/projekte/${id}`) }} />
      )}
    </div>
  )
}
