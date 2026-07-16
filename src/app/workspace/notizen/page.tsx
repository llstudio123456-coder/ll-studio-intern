'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  StickyNote, Plus, Search, Pin, Star, Archive, Trash2, RefreshCw, X, Lock, Users, Building2, ShieldCheck, Crown, Check
} from 'lucide-react'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui/Ui'
import {
  NOTE_KIND_LABELS, NOTE_VISIBILITY_LABELS, NOTE_VISIBILITY_HINTS, excerpt,
  type Note, type NoteKind, type NoteVisibility
} from '@shared/notes'

const VIS_ICON: Record<NoteVisibility, typeof Lock> = {
  private: Lock,
  shared: Users,
  company: Building2,
  admins: ShieldCheck,
  owner: Crown
}

export default function NotesPage() {
  return (
    <Suspense fallback={null}>
      <NotesInner />
    </Suspense>
  )
}

function NotesInner() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') || ''
  const tag = params.get('tag') || ''
  const archived = params.get('archived') === '1'

  const [data, setData] = useState<{ notes: Note[]; total: number; tags: string[]; visibilities: NoteVisibility[] } | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Note | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState(q)

  const load = useCallback(async () => {
    setError('')
    try {
      const u = new URLSearchParams()
      if (q) u.set('q', q)
      if (tag) u.set('tag', tag)
      if (archived) u.set('archived', '1')
      const r = await fetch(`/api/workspace/notes?${u}`)
      const d = await r.json()
      if (!r.ok) { setError(d?.error || 'Die Notizen konnten nicht geladen werden.'); return }
      setData(d)
    } catch {
      setError('Die Notizen konnten nicht geladen werden.')
    }
  }, [q, tag, archived])

  useEffect(() => { load() }, [load])

  // Suchfeld an die URL koppeln, aber entprellt — sonst eine Anfrage je Tastendruck.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search === q) return
      const u = new URLSearchParams(params.toString())
      if (search) u.set('q', search); else u.delete('q')
      router.replace(`/workspace/notizen?${u}`)
    }, 300)
    return () => clearTimeout(t)
  }, [search, q, params, router])

  const setParam = (k: string, v: string | null) => {
    const u = new URLSearchParams(params.toString())
    if (v) u.set(k, v); else u.delete(k)
    router.replace(`/workspace/notizen?${u}`)
  }

  const act = async (id: string, body: Record<string, unknown>) => {
    setError('')
    try {
      const r = await fetch(`/api/workspace/notes/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Die Aktion konnte nicht ausgeführt werden.'); return }
      await load()
    } catch {
      setError('Die Aktion konnte nicht ausgeführt werden.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        eyebrow="Workspace"
        icon={StickyNote}
        title="Notizen"
        subtitle={data ? `${data.total} Notiz${data.total === 1 ? '' : 'en'}${archived ? ' im Archiv' : ''}` : 'Wird geladen …'}
        action={
          <button onClick={() => setCreating(true)} className="btn-ink flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <Plus size={14} /> Neue Notiz
          </button>
        }
      />

      {/* Suche + Filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Notizen durchsuchen …"
            className="inp pl-9"
            aria-label="Notizen durchsuchen"
          />
        </div>
        <button
          onClick={() => setParam('archived', archived ? null : '1')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${archived ? 'bg-[var(--color-gold-soft)] text-[var(--color-ink)]' : 'btn-ghost'}`}
        >
          <Archive size={14} /> Archiv
        </button>
      </div>

      {data && data.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.tags.map((t) => (
            <button
              key={t}
              onClick={() => setParam('tag', tag === t ? null : t)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${tag === t ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-paper-2)] text-[var(--color-ink-soft)] hover:bg-[var(--color-hover)]'}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Liste */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!data && <div className="sm:col-span-2 lg:col-span-3"><SkeletonRows rows={3} /></div>}
        {data?.notes.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon={StickyNote}
              title={q || tag ? 'Keine Treffer' : archived ? 'Nichts im Archiv' : 'Noch keine Notizen'}
              description={q || tag ? 'Andere Suche oder Filter probieren.' : 'Halte fest, was sonst verloren geht — Gesprächsnotizen, Ideen, offene Punkte.'}
            />
          </div>
        )}
        {data?.notes.map((n) => (
          <NoteCard key={n.id} n={n} onOpen={() => setOpen(n)} onAct={act} />
        ))}
      </div>

      {creating && data && (
        <NoteEditor
          visibilities={data.visibilities}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load() }}
        />
      )}
      {open && data && (
        <NoteEditor
          note={open}
          visibilities={data.visibilities}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); load() }}
        />
      )}
    </div>
  )
}

function NoteCard({ n, onOpen, onAct }: { n: Note; onOpen: () => void; onAct: (id: string, b: Record<string, unknown>) => void }) {
  const Vis = VIS_ICON[n.visibility] || Lock
  return (
    <article className="card group flex flex-col p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="truncate font-medium text-[var(--color-ink)]">{n.title || NOTE_KIND_LABELS[n.kind]}</h3>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Mini icon={Pin} label={n.pinned ? 'Lösen' : 'Anheften'} active={n.pinned} onClick={() => onAct(n.id, { action: 'update', pinned: !n.pinned })} />
          <Mini icon={Star} label={n.favorite ? 'Favorit entfernen' : 'Als Favorit'} active={n.favorite} onClick={() => onAct(n.id, { action: 'update', favorite: !n.favorite })} />
          <Mini icon={Archive} label={n.archivedAt ? 'Aus dem Archiv' : 'Archivieren'} onClick={() => onAct(n.id, { action: n.archivedAt ? 'unarchive' : 'archive' })} />
          <Mini icon={Trash2} label="In den Papierkorb" danger onClick={() => onAct(n.id, { action: 'trash' })} />
        </div>
      </div>

      <button onClick={onOpen} className="mt-1.5 flex-1 text-left">
        <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">{excerpt(n.body) || <span className="text-[var(--color-muted)]">Leer</span>}</p>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {n.tags.map((t) => (
          <span key={t} className="rounded-full bg-[var(--color-paper-2)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">#{t}</span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-line)] pt-2.5 text-[11px] text-[var(--color-muted)]">
        <span className="flex items-center gap-1" title={NOTE_VISIBILITY_HINTS[n.visibility]}>
          <Vis size={11} /> {NOTE_VISIBILITY_LABELS[n.visibility]}
        </span>
        <span className="flex items-center gap-1.5">
          {n.pinned && <Pin size={10} className="text-[var(--color-gold)]" />}
          {n.favorite && <Star size={10} className="text-[var(--color-gold)]" />}
          {fmt(n.updatedAt)}
        </span>
      </div>
      {n.companyName && (
        <div className="mt-1.5 truncate text-[11px] text-[var(--color-gold)]">{n.companyName}</div>
      )}
    </article>
  )
}

function Mini({ icon: Icon, label, onClick, active, danger }: { icon: typeof Pin; label: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : active ? 'text-[var(--color-gold)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]'}`}
    >
      <Icon size={13} />
    </button>
  )
}

/** Editor mit automatischer Speicherung — nichts geht beim Schließen verloren. */
function NoteEditor({ note, visibilities, onClose, onSaved }: { note?: Note; visibilities: NoteVisibility[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(note?.title || '')
  const [body, setBody] = useState(note?.body || '')
  const [kind, setKind] = useState<NoteKind>(note?.kind || 'persoenlich')
  const [visibility, setVisibility] = useState<NoteVisibility>(note?.visibility || 'private')
  const [tagsText, setTagsText] = useState((note?.tags || []).join(', '))
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState('')
  const idRef = useRef(note?.id || '')
  const dirty = useRef(false)

  const parseTags = () => tagsText.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)

  const save = useCallback(async () => {
    if (!dirty.current) return
    if (!body.trim() && !title.trim()) return // Leere Notiz nicht anlegen
    setSaved('saving'); setError('')
    try {
      const payload = { kind, title, body, visibility, tags: parseTags() }
      const r = idRef.current
        ? await fetch(`/api/workspace/notes/${idRef.current}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', ...payload }) })
        : await fetch('/api/workspace/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Speichern nicht möglich.'); setSaved('idle'); return }
      if (!idRef.current && d?.note?.id) idRef.current = d.note.id
      dirty.current = false
      setSaved('done')
    } catch {
      setError('Speichern nicht möglich.')
      setSaved('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, kind, visibility, tagsText])

  // Automatisch speichern, während getippt wird.
  useEffect(() => {
    dirty.current = true
    setSaved('idle')
    const t = setTimeout(save, 900)
    return () => clearTimeout(t)
  }, [title, body, kind, visibility, tagsText, save])

  const close = async () => { await save(); onSaved() }
  const VisIcon = VIS_ICON[visibility] || Lock

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" onClick={close}>
      <div className="card w-full max-w-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel (optional)"
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent font-display text-2xl text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
            aria-label="Titel"
          />
          <button onClick={close} aria-label="Schließen" className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder="Schreib los … z. B. „Herrn Müller Freitag erneut anrufen“"
          className="mt-3 w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-[var(--color-ink-soft)] outline-none placeholder:text-[var(--color-muted)]"
          aria-label="Inhalt"
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Art</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as NoteKind)} className="inp py-1.5 text-xs">
              {(Object.keys(NOTE_KIND_LABELS) as NoteKind[]).map((k) => <option key={k} value={k}>{NOTE_KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Sichtbarkeit</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as NoteVisibility)} className="inp py-1.5 text-xs">
              {visibilities.map((v) => <option key={v} value={v}>{NOTE_VISIBILITY_LABELS[v]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Tags (mit Komma)</span>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="kunde, dringend" className="inp py-1.5 text-xs" />
          </label>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          <VisIcon size={11} /> {NOTE_VISIBILITY_HINTS[visibility]}
        </p>

        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            {saved === 'saving' && <><RefreshCw size={12} className="animate-spin" /> Wird gespeichert …</>}
            {saved === 'done' && <><Check size={12} className="text-emerald-600" /> Automatisch gespeichert</>}
          </span>
          <button onClick={close} className="btn-ink rounded-lg px-4 py-2 text-sm">Fertig</button>
        </div>
      </div>
    </div>
  )
}

function fmt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const heute = new Date().toDateString() === d.toDateString()
  return heute
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
