'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckSquare, Plus, Search, RefreshCw, X, Lock, Users, AlertTriangle, Calendar,
  LayoutGrid, List, Repeat, Trash2, Circle, CheckCircle2, Building2
} from 'lucide-react'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui/Ui'
import {
  TASK_KIND_LABELS, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_VISIBILITY_LABELS,
  RECURRENCE_LABELS, KANBAN_COLUMNS, CLOSED_STATUSES, isOverdue, isDueToday,
  type Recurrence, type Task, type TaskKind, type TaskPriority, type TaskStatus, type TaskVisibility
} from '@shared/tasks'

interface Data {
  tasks: Task[]
  total: number
  counts: Record<string, number>
  users: { id: string; name?: string; email: string }[]
  me: { id: string; role: string }
}

const VIEWS: { key: string; label: string; countKey?: string }[] = [
  { key: 'meine', label: 'Meine Aufgaben', countKey: 'meine' },
  { key: 'heute', label: 'Heute', countKey: 'heute' },
  { key: 'ueberfaellig', label: 'Überfällig', countKey: 'ueberfaellig' },
  { key: 'demnaechst', label: 'Demnächst', countKey: 'demnaechst' },
  { key: 'ohne_termin', label: 'Ohne Termin', countKey: 'ohne_termin' },
  { key: 'alle', label: 'Alle' },
  { key: 'erledigt', label: 'Erledigt' }
]

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksInner />
    </Suspense>
  )
}

function TasksInner() {
  const router = useRouter()
  const params = useSearchParams()
  const view = params.get('view') || 'meine'
  const layout = params.get('layout') || 'liste'
  const q = params.get('q') || ''

  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [open, setOpen] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState(q)

  const load = useCallback(async () => {
    setError('')
    try {
      const u = new URLSearchParams({ view, parent: 'root' })
      if (q) u.set('q', q)
      const r = await fetch(`/api/workspace/tasks?${u}`)
      const d = await r.json()
      if (!r.ok) { setError(d?.error || 'Die Aufgaben konnten nicht geladen werden.'); return }
      setData(d)
    } catch {
      setError('Die Aufgaben konnten nicht geladen werden.')
    }
  }, [view, q])

  useEffect(() => { load() }, [load])

  // Suche entprellt an die URL koppeln — sonst eine Anfrage je Tastendruck.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search === q) return
      const u = new URLSearchParams(params.toString())
      if (search) u.set('q', search); else u.delete('q')
      router.replace(`/workspace/aufgaben?${u}`)
    }, 300)
    return () => clearTimeout(t)
  }, [search, q, params, router])

  const setParam = (k: string, v: string) => {
    const u = new URLSearchParams(params.toString())
    u.set(k, v)
    router.replace(`/workspace/aufgaben?${u}`)
  }

  const act = async (id: string, body: Record<string, unknown>) => {
    setError(''); setInfo('')
    try {
      const r = await fetch(`/api/workspace/tasks/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Die Aktion konnte nicht ausgeführt werden.'); return }
      // Wiederkehrende Aufgaben erzeugen beim Abhaken die nächste — das darf nicht stillschweigend
      // passieren, sonst wundert man sich über die „wieder aufgetauchte" Aufgabe.
      if (d?.followUp) setInfo(`Nächster Termin angelegt: ${fmtDate(d.followUp.dueDate)}`)
      await load()
    } catch {
      setError('Die Aktion konnte nicht ausgeführt werden.')
    }
  }

  const toggle = (t: Task) => act(t.id, { action: 'status', status: t.status === 'erledigt' ? 'offen' : 'erledigt' })

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        eyebrow="Workspace"
        icon={CheckSquare}
        title="Aufgaben"
        subtitle={data ? `${data.total} Aufgabe${data.total === 1 ? '' : 'n'}` : 'Wird geladen …'}
        action={
          <button onClick={() => setCreating(true)} className="btn-ink flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <Plus size={14} /> Neue Aufgabe
          </button>
        }
      />

      {/* Ansichten */}
      <div className="mt-4 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {VIEWS.map((v) => {
          const n = v.countKey ? data?.counts?.[v.countKey] : undefined
          const active = view === v.key
          const alarm = v.key === 'ueberfaellig' && !!n
          return (
            <button
              key={v.key}
              onClick={() => setParam('view', v.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-hover)]'
              }`}
            >
              {v.label}
              {n != null && n > 0 && (
                <span className={`rounded-md px-1.5 text-[10px] tabular-nums ${
                  active ? 'bg-white/20' : alarm ? 'bg-red-100 text-red-700' : 'bg-[var(--color-paper-2)] text-[var(--color-muted)]'
                }`}>{n}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Suche + Darstellung */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Aufgaben durchsuchen …" className="inp pl-9" aria-label="Aufgaben durchsuchen" />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[var(--color-line)]">
          <LayoutBtn active={layout === 'liste'} onClick={() => setParam('layout', 'liste')} icon={List} label="Liste" />
          <LayoutBtn active={layout === 'kanban'} onClick={() => setParam('layout', 'kanban')} icon={LayoutGrid} label="Kanban" />
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {info && (
        <p className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-gold)]/10 px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          <span className="flex items-center gap-2"><Repeat size={14} className="text-[var(--color-gold)]" /> {info}</span>
          <button onClick={() => setInfo('')} aria-label="Hinweis schließen"><X size={14} /></button>
        </p>
      )}

      <div className="mt-5">
        {!data && <SkeletonRows rows={5} />}
        {data?.tasks.length === 0 && (
          <EmptyState
            icon={CheckSquare}
            title={q ? 'Keine Treffer' : view === 'ueberfaellig' ? 'Nichts überfällig' : 'Keine Aufgaben'}
            description={q ? 'Andere Suche probieren.' : 'Lege fest, was ansteht — mit Termin, Priorität und Zuständigkeit.'}
          />
        )}
        {data && data.tasks.length > 0 && layout === 'kanban' && <Kanban tasks={data.tasks} onOpen={setOpen} onAct={act} />}
        {data && data.tasks.length > 0 && layout === 'liste' && (
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
            {data.tasks.map((t) => <Row key={t.id} t={t} onOpen={() => setOpen(t)} onToggle={() => toggle(t)} onAct={act} />)}
          </div>
        )}
      </div>

      {(creating || open) && data && (
        <TaskEditor
          task={open || undefined}
          users={data.users}
          meId={data.me.id}
          onClose={() => { setCreating(false); setOpen(null) }}
          onSaved={() => { setCreating(false); setOpen(null); load() }}
        />
      )}
    </div>
  )
}

function LayoutBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof List; label: string }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={`px-2.5 py-2 transition-colors ${active ? 'bg-[var(--color-gold-soft)] text-[var(--color-ink)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-hover)]'}`}>
      <Icon size={15} />
    </button>
  )
}

function Row({ t, onOpen, onToggle, onAct }: { t: Task; onOpen: () => void; onToggle: () => void; onAct: (id: string, b: Record<string, unknown>) => void }) {
  const done = t.status === 'erledigt'
  const over = isOverdue(t)
  return (
    <div className="group flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0 hover:bg-[var(--color-hover)]">
      <button onClick={onToggle} aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'} className="shrink-0">
        {done
          ? <CheckCircle2 size={18} className="text-emerald-600" />
          : <Circle size={18} className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-gold)]" />}
      </button>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm ${done ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-ink)]'}`}>{t.title}</span>
          {t.visibility === 'private' && <Lock size={11} className="shrink-0 text-[var(--color-muted)]" aria-label="Privat" />}
          {t.recurrence && <Repeat size={11} className="shrink-0 text-[var(--color-muted)]" aria-label={RECURRENCE_LABELS[t.recurrence]} />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--color-muted)]">
          {t.dueDate && (
            <span className={`flex items-center gap-1 ${over ? 'font-medium text-red-600' : isDueToday(t) ? 'font-medium text-[var(--color-gold)]' : ''}`}>
              {over ? <AlertTriangle size={10} /> : <Calendar size={10} />} {fmtDate(t.dueDate)}
            </span>
          )}
          {t.assigneeName && <span>{t.assigneeName}</span>}
          {t.companyName && <span className="flex items-center gap-1 text-[var(--color-gold)]"><Building2 size={10} /> {t.companyName}</span>}
          {t.subtaskCount ? <span>{t.subtasksDone}/{t.subtaskCount} Teilaufgaben</span> : null}
          {t.tags.map((x) => <span key={x}>#{x}</span>)}
        </div>
      </button>

      <PriorityDot p={t.priority} />
      <span className="hidden shrink-0 text-[11px] text-[var(--color-muted)] sm:inline">{TASK_STATUS_LABELS[t.status]}</span>
      <button
        onClick={() => onAct(t.id, { action: 'trash' })}
        aria-label="In den Papierkorb"
        className="shrink-0 rounded-md p-1.5 text-red-600 opacity-0 transition-opacity hover:bg-red-50 group-hover:opacity-100 focus:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

/** Kanban ohne Drag-and-drop: Der Status wechselt über ein Auswahlfeld — das funktioniert
 *  auf dem Smartphone genauso wie am Rechner (Spezifikation §5). */
function Kanban({ tasks, onOpen, onAct }: { tasks: Task[]; onOpen: (t: Task) => void; onAct: (id: string, b: Record<string, unknown>) => void }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {KANBAN_COLUMNS.map((col) => {
        const list = tasks.filter((t) => t.status === col)
        return (
          <div key={col} className="w-[280px] shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-medium text-[var(--color-ink-soft)]">{TASK_STATUS_LABELS[col]}</h3>
              <span className="text-[10px] tabular-nums text-[var(--color-muted)]">{list.length}</span>
            </div>
            <div className="space-y-2 rounded-xl bg-[var(--color-paper-2)]/50 p-2">
              {list.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-[var(--color-muted)]">Leer</p>}
              {list.map((t) => (
                <article key={t.id} className="card p-3">
                  <button onClick={() => onOpen(t)} className="w-full text-left">
                    <div className="flex items-start gap-1.5">
                      <span className="min-w-0 flex-1 text-sm text-[var(--color-ink)]">{t.title}</span>
                      {t.visibility === 'private' && <Lock size={10} className="mt-1 shrink-0 text-[var(--color-muted)]" />}
                    </div>
                    {t.dueDate && (
                      <div className={`mt-1.5 flex items-center gap-1 text-[10px] ${isOverdue(t) ? 'font-medium text-red-600' : 'text-[var(--color-muted)]'}`}>
                        <Calendar size={9} /> {fmtDate(t.dueDate)}
                      </div>
                    )}
                  </button>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--color-line)] pt-2">
                    <PriorityDot p={t.priority} />
                    <select
                      value={t.status}
                      onChange={(e) => onAct(t.id, { action: 'status', status: e.target.value as TaskStatus })}
                      className="min-w-0 flex-1 rounded border-0 bg-transparent text-[10px] text-[var(--color-muted)] outline-none"
                      aria-label={`Status von ${t.title}`}
                    >
                      {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PriorityDot({ p }: { p: TaskPriority }) {
  const tone = p === 'dringend' ? 'bg-red-500' : p === 'hoch' ? 'bg-amber-500' : p === 'normal' ? 'bg-[var(--color-line)]' : 'bg-transparent border border-[var(--color-line)]'
  if (p === 'niedrig') return null
  return <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} title={TASK_PRIORITY_LABELS[p]} aria-label={`Priorität: ${TASK_PRIORITY_LABELS[p]}`} />
}

function TaskEditor({ task, users, meId, onClose, onSaved }: {
  task?: Task
  users: { id: string; name?: string; email: string }[]
  meId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState({
    title: task?.title || '',
    description: task?.description || '',
    kind: task?.kind || ('persoenlich' as TaskKind),
    status: task?.status || ('offen' as TaskStatus),
    priority: task?.priority || ('normal' as TaskPriority),
    visibility: task?.visibility || ('team' as TaskVisibility),
    assigneeId: task?.assigneeId || meId,
    dueDate: task?.dueDate || '',
    dueTime: task?.dueTime || '',
    recurrence: task?.recurrence || '',
    tagsText: (task?.tags || []).join(', ')
  })
  const [checklist, setChecklist] = useState(task?.checklist || [])
  const [newItem, setNewItem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (busy) return
    if (!f.title.trim()) { setError('Die Aufgabe braucht einen Titel.'); return }
    setBusy(true); setError('')
    const payload = {
      ...f,
      tags: f.tagsText.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      dueDate: f.dueDate || null,
      dueTime: f.dueTime || null,
      recurrence: f.recurrence || null,
      assigneeId: f.assigneeId || null
    }
    try {
      const r = task
        ? await fetch(`/api/workspace/tasks/${task.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', ...payload }) })
        : await fetch('/api/workspace/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Speichern nicht möglich.'); setBusy(false); return }
      onSaved()
    } catch {
      setError('Speichern nicht möglich.')
      setBusy(false)
    }
  }

  const addItem = async () => {
    if (!task || !newItem.trim()) return
    const r = await fetch(`/api/workspace/tasks/${task.id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'checklist.add', text: newItem })
    })
    const d = await r.json().catch(() => null)
    if (d?.checklist) { setChecklist(d.checklist); setNewItem('') }
  }

  const toggleItem = async (itemId: string, done: boolean) => {
    if (!task) return
    const r = await fetch(`/api/workspace/tasks/${task.id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'checklist.toggle', itemId, done })
    })
    const d = await r.json().catch(() => null)
    if (d?.checklist) setChecklist(d.checklist)
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" onClick={onClose}>
      <div className="card w-full max-w-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <input
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="Was ist zu tun?"
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent font-display text-2xl text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
            aria-label="Titel"
          />
          <button onClick={onClose} aria-label="Schließen" className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        <textarea
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          rows={3}
          placeholder="Beschreibung (optional)"
          className="mt-2 w-full resize-y border-0 bg-transparent text-sm text-[var(--color-ink-soft)] outline-none placeholder:text-[var(--color-muted)]"
          aria-label="Beschreibung"
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Zuständig">
            <select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} className="inp py-1.5 text-xs">
              <option value="">Niemand</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}{u.id === meId ? ' (ich)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Fällig am">
            <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className="inp py-1.5 text-xs" />
          </Field>
          <Field label="Uhrzeit">
            <input type="time" value={f.dueTime} onChange={(e) => setF({ ...f, dueTime: e.target.value })} className="inp py-1.5 text-xs" />
          </Field>
          <Field label="Priorität">
            <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TaskPriority })} className="inp py-1.5 text-xs">
              {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TaskStatus })} className="inp py-1.5 text-xs">
              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          <Field label="Art">
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as TaskKind })} className="inp py-1.5 text-xs">
              {(Object.keys(TASK_KIND_LABELS) as TaskKind[]).map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Sichtbarkeit">
            <select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value as TaskVisibility })} className="inp py-1.5 text-xs">
              {(Object.keys(TASK_VISIBILITY_LABELS) as TaskVisibility[]).map((v) => <option key={v} value={v}>{TASK_VISIBILITY_LABELS[v]}</option>)}
            </select>
          </Field>
          <Field label="Wiederholung">
            <select value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value })} className="inp py-1.5 text-xs">
              <option value="">Einmalig</option>
              {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
            </select>
          </Field>
          <Field label="Tags (mit Komma)">
            <input value={f.tagsText} onChange={(e) => setF({ ...f, tagsText: e.target.value })} placeholder="kunde, website" className="inp py-1.5 text-xs" />
          </Field>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          {f.visibility === 'private'
            ? <><Lock size={11} /> Nur du und der Zuständige sehen diese Aufgabe — auch kein Administrator.</>
            : <><Users size={11} /> Alle Mitarbeiter sehen diese Aufgabe.</>}
        </p>
        {f.recurrence && f.dueDate && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            <Repeat size={11} /> Nach dem Abhaken entsteht automatisch der nächste Termin.
          </p>
        )}

        {/* Checkliste gibt es erst, wenn die Aufgabe existiert. */}
        {task && (
          <div className="mt-5 border-t border-[var(--color-line)] pt-4">
            <h3 className="mb-2 text-xs font-medium text-[var(--color-muted)]">Checkliste</h3>
            <div className="space-y-1.5">
              {checklist.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.done} onChange={(e) => toggleItem(c.id, e.target.checked)} />
                  <span className={c.done ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-ink-soft)]'}>{c.text}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                placeholder="Punkt hinzufügen …"
                className="inp py-1.5 text-xs"
              />
              <button onClick={addItem} disabled={!newItem.trim()} className="btn-ghost shrink-0 rounded-lg px-3 text-xs">Hinzufügen</button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--color-line)] pt-4">
          <button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">Abbrechen</button>
          <button onClick={save} disabled={busy || !f.title.trim()} className="btn-ink flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
            {busy && <RefreshCw size={13} className="animate-spin" />} {task ? 'Speichern' : 'Aufgabe anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  )
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - heute.getTime()) / 86400000)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Morgen'
  if (diff === -1) return 'Gestern'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
