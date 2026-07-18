'use client'
import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, MessageSquare, HardDrive, CheckSquare, Users, Pencil, Archive, Trash2,
  RefreshCw, Calendar, Lock, ChevronRight, Plus
} from 'lucide-react'
import { PageHeader, SkeletonRows } from '@/components/ui/Ui'
import { ProjectEditor } from '@/components/workspace/ProjectEditor'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { PROJECT_KIND_LABELS, PROJECT_STATUS_LABELS, PROJECT_PRIORITY_LABELS, type Project } from '@shared/projects'
import { TASK_STATUS_LABELS, isOverdue, type Task } from '@shared/tasks'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [meta, setMeta] = useState<{ users: { id: string; name?: string; email: string }[]; companies: { id: string; name: string }[]; meId: string } | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`/api/workspace/projects/${id}`)
      const d = await r.json()
      if (!r.ok) { setError(d?.error || 'Das Projekt wurde nicht gefunden.'); setProject(null); return }
      setProject(d.project)
      // Aufgaben des Projekts + Metadaten für den Bearbeiten-Dialog.
      const [tRes, lRes] = await Promise.all([
        fetch(`/api/workspace/tasks?projectId=${id}&parent=root`),
        fetch('/api/workspace/projects')
      ])
      const tData = await tRes.json().catch(() => null)
      if (tData?.tasks) setTasks(tData.tasks)
      const lData = await lRes.json().catch(() => null)
      if (lData) setMeta({ users: lData.users, companies: lData.companies, meId: lData.me.id })
    } catch {
      setError('Das Projekt konnte nicht geladen werden.')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const act = async (body: Record<string, unknown>) => {
    const r = await fetch(`/api/workspace/projects/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => null)
    if (!r.ok) { setError(d?.error || 'Die Aktion konnte nicht ausgeführt werden.'); return false }
    return true
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1000px]">
        <button onClick={() => router.push('/workspace/projekte')} className="mb-4 flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"><ArrowLeft size={14} /> Zu den Projekten</button>
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    )
  }
  if (!project) return <div className="mx-auto w-full max-w-[1000px]"><SkeletonRows rows={6} /></div>

  const overdueTasks = tasks.filter((t) => isOverdue(t)).length

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <button onClick={() => router.push('/workspace/projekte')} className="mb-3 flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        <ArrowLeft size={14} /> Projekte
      </button>

      <PageHeader
        eyebrow={PROJECT_KIND_LABELS[project.kind]}
        icon={project.visibility === 'private' ? Lock : Building2}
        title={project.name}
        subtitle={project.companyName ? `Kunde: ${project.companyName}` : undefined}
        action={project.canEdit ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><Pencil size={14} /> Bearbeiten</button>
          </div>
        ) : undefined}
      />

      {/* Status + Fortschritt */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-[var(--color-muted)]">Status</div>
          <div className="mt-1 font-medium">{PROJECT_STATUS_LABELS[project.status]}</div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">Priorität: {PROJECT_PRIORITY_LABELS[project.priority]}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--color-muted)]">Fortschritt</div>
          <div className="mt-1 flex items-baseline gap-1"><span className="text-2xl font-semibold tabular-nums">{project.progress ?? 0}</span><span className="text-sm text-[var(--color-muted)]">%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-paper-2)]">
            <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${project.progress ?? 0}%` }} />
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--color-muted)]">Termin</div>
          <div className="mt-1 flex items-center gap-1.5 font-medium">
            {project.dueDate ? <><Calendar size={14} className="text-[var(--color-muted)]" /> {new Date(project.dueDate).toLocaleDateString('de-DE')}</> : '—'}
          </div>
          {overdueTasks > 0 && <div className="mt-0.5 text-xs text-red-600">{overdueTasks} überfällige Aufgabe{overdueTasks === 1 ? '' : 'n'}</div>}
        </div>
      </div>

      {project.description && <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-ink-soft)]">{project.description}</p>}

      {/* Verknüpfte Bereiche */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {project.chatChannelId && <LinkCard href={`/workspace/chat?kanal=${project.chatChannelId}`} icon={MessageSquare} title="Projektchat" hint="Nachrichten zum Projekt" />}
        {project.folderId && <LinkCard href="/workspace" icon={HardDrive} title="Projektordner" hint="Dateien und Dokumente" />}
        <LinkCard href={`/workspace/aufgaben`} icon={CheckSquare} title="Aufgaben" hint={`${project.taskDone ?? 0}/${project.taskCount ?? 0} erledigt`} />
      </div>

      {/* Aufgaben */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg">Aufgaben</h2>
          <Link href="/workspace/aufgaben" className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"><Plus size={12} /> in Aufgaben anlegen</Link>
        </div>
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-line)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            Noch keine Aufgaben. Lege in „Aufgaben" welche an und ordne sie diesem Projekt zu.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-2.5 last:border-b-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${t.status === 'erledigt' ? 'bg-emerald-500' : isOverdue(t) ? 'bg-red-500' : 'bg-[var(--color-line)]'}`} />
                <span className={`min-w-0 flex-1 truncate text-sm ${t.status === 'erledigt' ? 'text-[var(--color-muted)] line-through' : ''}`}>{t.title}</span>
                <span className="shrink-0 text-[11px] text-[var(--color-muted)]">{TASK_STATUS_LABELS[t.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team */}
      <div className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg"><Users size={16} /> Team</h2>
        <div className="flex flex-wrap gap-2">
          {project.members?.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-[var(--color-paper-2)] px-2.5 py-1 text-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-gold-soft)] text-[10px] font-semibold">{(m.name || m.email)[0]?.toUpperCase()}</span>
              {m.name || m.email}
              {m.role === 'leitung' && <span className="text-[10px] text-[var(--color-gold)]">Leitung</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Verwaltung */}
      {project.canEdit && (
        <div className="mt-8 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-4">
          <button onClick={async () => { if (await act({ action: project.archivedAt ? 'unarchive' : 'archive' })) load() }} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <Archive size={14} /> {project.archivedAt ? 'Aus dem Archiv holen' : 'Archivieren'}
          </button>
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> In den Papierkorb
          </button>
        </div>
      )}

      {editing && meta && (
        <ProjectEditor project={project} users={meta.users} companies={meta.companies} meId={meta.meId}
          onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Projekt in den Papierkorb"
          body={`„${project.name}" wird in den Papierkorb verschoben. Verknüpfte Aufgaben, Chat und Dateien bleiben erhalten.`}
          confirmLabel="In den Papierkorb"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => { setConfirmDelete(false); if (await act({ action: 'trash' })) router.push('/workspace/projekte') }}
        />
      )}
    </div>
  )
}

function LinkCard({ href, icon: Icon, title, hint }: { href: string; icon: typeof MessageSquare; title: string; hint: string }) {
  return (
    <Link href={href} className="card flex items-center gap-3 p-3.5 transition-shadow hover:shadow-md">
      <Icon size={18} className="shrink-0 text-[var(--color-gold)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-[11px] text-[var(--color-muted)]">{hint}</div>
      </div>
      <ChevronRight size={15} className="shrink-0 text-[var(--color-muted)]" />
    </Link>
  )
}
