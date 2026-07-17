'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  MessageSquare, Send, Hash, Lock, Plus, X, Reply, Pin, Pencil, Trash2, CheckSquare,
  StickyNote, RefreshCw, Search, Users, ArrowLeft, Megaphone
} from 'lucide-react'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui/Ui'
import { messageExcerpt, type Channel, type ChatMessage } from '@shared/chat'

interface ListData {
  channels: Channel[]
  users: { id: string; name?: string; email: string; picture?: string }[]
  me: { id: string; role: string }
}
interface ChannelData {
  channel: Channel
  messages: ChatMessage[]
  pinned: ChatMessage[]
  users: { id: string; name?: string; email: string; picture?: string }[]
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  )
}

function ChatInner() {
  const router = useRouter()
  const params = useSearchParams()
  const channelId = params.get('kanal') || ''

  const [list, setList] = useState<ListData | null>(null)
  const [data, setData] = useState<ChannelData | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadList = useCallback(async () => {
    try {
      const r = await fetch('/api/workspace/chat/channels')
      const d = await r.json()
      if (r.ok) setList(d)
    } catch { /* stumm: die Kanalliste ist Beiwerk, der Fehler unten zählt */ }
  }, [])

  const loadChannel = useCallback(async () => {
    if (!channelId) { setData(null); return }
    setError('')
    try {
      const r = await fetch(`/api/workspace/chat/channels/${channelId}`)
      const d = await r.json()
      if (!r.ok) { setError(d?.error || 'Der Kanal konnte nicht geladen werden.'); setData(null); return }
      setData(d)
    } catch {
      setError('Der Kanal konnte nicht geladen werden.')
    }
  }, [channelId])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadChannel() }, [loadChannel])

  // Echtzeit: Ereignisse betreffen nur Kanäle, die dieser Benutzer lesen darf — das entscheidet
  // der Server beim Verteilen, nicht der Browser.
  useEffect(() => {
    const es = new EventSource('/api/workspace/chat/stream')
    const onChange = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as { channelId: string }
        if (ev.channelId === channelId) loadChannel()
        loadList() // Ungelesen-Zähler aktualisieren
      } catch { /* fehlerhaftes Ereignis ignorieren */ }
    }
    es.addEventListener('message', onChange)
    es.addEventListener('update', onChange)
    es.addEventListener('delete', onChange)
    return () => es.close()
  }, [channelId, loadChannel, loadList])

  // Ans Ende springen, wenn neue Nachrichten da sind.
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [data?.messages.length])

  const send = async () => {
    if (sending || !text.trim()) return
    setSending(true); setError('')
    try {
      if (editing) {
        const r = await fetch(`/api/workspace/chat/messages/${editing.id}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'edit', body: text })
        })
        const d = await r.json().catch(() => null)
        if (!r.ok) { setError(d?.error || 'Ändern nicht möglich.'); return }
        setEditing(null)
      } else {
        const r = await fetch(`/api/workspace/chat/channels/${channelId}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'send', body: text, replyTo: replyTo?.id })
        })
        const d = await r.json().catch(() => null)
        if (!r.ok) { setError(d?.error || 'Senden nicht möglich.'); return }
        setReplyTo(null)
      }
      setText('')
      await loadChannel()
    } catch {
      setError('Senden nicht möglich.')
    } finally { setSending(false) }
  }

  const msgAct = async (m: ChatMessage, body: Record<string, unknown>) => {
    setError(''); setInfo('')
    try {
      const r = await fetch(`/api/workspace/chat/messages/${m.id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Die Aktion konnte nicht ausgeführt werden.'); return }
      if (d?.task) setInfo(`Aufgabe angelegt: „${d.task.title}“`)
      if (d?.note) setInfo('Notiz angelegt — sie ist zunächst nur für dich sichtbar.')
      await loadChannel()
    } catch {
      setError('Die Aktion konnte nicht ausgeführt werden.')
    }
  }

  const openDm = async (userId: string) => {
    const r = await fetch('/api/workspace/chat/channels', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'dm', userId })
    })
    const d = await r.json().catch(() => null)
    if (d?.channel) { setShowNew(false); await loadList(); router.replace(`/workspace/chat?kanal=${d.channel.id}`) }
  }

  const totalUnread = list?.channels.reduce((n, c) => n + (c.unread || 0), 0) || 0

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        eyebrow="Workspace"
        icon={MessageSquare}
        title="Chat"
        subtitle={totalUnread > 0 ? `${totalUnread} ungelesen` : list ? 'Alles gelesen' : 'Wird geladen …'}
        action={
          <button onClick={() => setShowNew(true)} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <Plus size={14} /> Neu
          </button>
        }
      />

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {info && (
        <p className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-gold)]/10 px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          <span>{info}</span>
          <button onClick={() => setInfo('')} aria-label="Hinweis schließen"><X size={14} /></button>
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* Kanalliste — auf dem Smartphone nur sichtbar, wenn kein Kanal offen ist */}
        <aside className={`${channelId ? 'hidden lg:block' : ''}`}>
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
            {!list && <div className="p-3"><SkeletonRows rows={4} /></div>}
            {list?.channels.map((c) => (
              <button
                key={c.id}
                onClick={() => router.replace(`/workspace/chat?kanal=${c.id}`)}
                className={`flex w-full items-center gap-2 border-b border-[var(--color-line)] px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 ${
                  c.id === channelId ? 'bg-[var(--color-gold-soft)]/45 font-medium' : 'hover:bg-[var(--color-hover)]'
                }`}
              >
                <ChannelIcon c={c} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {!!c.unread && <span className="rounded-md bg-[var(--color-ink)] px-1.5 text-[10px] tabular-nums text-white">{c.unread}</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* Unterhaltung */}
        <section className={`${!channelId ? 'hidden lg:block' : ''}`}>
          {!channelId && (
            <EmptyState icon={MessageSquare} title="Kanal wählen" description="Wähle links einen Kanal oder starte eine Direktnachricht." />
          )}

          {channelId && !data && !error && <SkeletonRows rows={6} />}

          {data && (
            <div className="flex h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-[var(--color-line)]">
              {/* Kopf */}
              <header className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
                <button onClick={() => router.replace('/workspace/chat')} className="lg:hidden" aria-label="Zurück"><ArrowLeft size={16} /></button>
                <ChannelIcon c={data.channel} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-medium">{data.channel.name}</h2>
                  {data.channel.description && <p className="truncate text-[11px] text-[var(--color-muted)]">{data.channel.description}</p>}
                </div>
                <span className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                  <Users size={11} /> {data.channel.members?.length ?? 0}
                </span>
              </header>

              {data.pinned.length > 0 && (
                <div className="border-b border-[var(--color-line)] bg-[var(--color-gold)]/5 px-4 py-2">
                  {data.pinned.map((m) => (
                    <p key={m.id} className="flex items-start gap-1.5 text-[11px] text-[var(--color-ink-soft)]">
                      <Pin size={10} className="mt-0.5 shrink-0 text-[var(--color-gold)]" />
                      <span className="truncate"><strong>{m.authorName}:</strong> {messageExcerpt(m.body, 90)}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* Nachrichten */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {data.messages.length === 0 && (
                  <p className="py-10 text-center text-sm text-[var(--color-muted)]">Noch keine Nachrichten. Fang an.</p>
                )}
                {data.messages.map((m) => (
                  <Message key={m.id} m={m} meId={list?.me.id} onReply={() => { setReplyTo(m); inputRef.current?.focus() }}
                    onEdit={() => { setEditing(m); setText(m.body); inputRef.current?.focus() }} onAct={msgAct} />
                ))}
                <div ref={endRef} />
              </div>

              {/* Eingabe */}
              <footer className="border-t border-[var(--color-line)] p-3">
                {!data.channel.canWrite ? (
                  <p className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--color-muted)]">
                    <Lock size={12} /> {data.channel.archivedAt ? 'Dieser Kanal ist archiviert.' : 'In diesem Kanal darfst du nur mitlesen.'}
                  </p>
                ) : (
                  <>
                    {(replyTo || editing) && (
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-paper-2)] px-3 py-1.5 text-[11px]">
                        <span className="truncate text-[var(--color-muted)]">
                          {editing ? 'Nachricht ändern' : `Antwort an ${replyTo?.authorName}: ${messageExcerpt(replyTo?.body || '', 50)}`}
                        </span>
                        <button onClick={() => { setReplyTo(null); setEditing(null); setText('') }} aria-label="Abbrechen"><X size={12} /></button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter sendet, Shift+Enter macht einen Umbruch — wie überall gewohnt.
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                        }}
                        rows={1}
                        placeholder="Nachricht schreiben … (@ erwähnt jemanden)"
                        className="inp max-h-32 min-h-[40px] resize-y py-2 text-sm"
                        aria-label="Nachricht"
                      />
                      <button onClick={send} disabled={sending || !text.trim()} aria-label="Senden"
                        className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                        {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </>
                )}
              </footer>
            </div>
          )}
        </section>
      </div>

      {showNew && list && <NewDialog users={list.users} meId={list.me.id} meRole={list.me.role} onDm={openDm}
        onCreated={async (id) => { setShowNew(false); await loadList(); router.replace(`/workspace/chat?kanal=${id}`) }}
        onClose={() => setShowNew(false)} />}
    </div>
  )
}

function ChannelIcon({ c }: { c: Channel }) {
  if (c.kind === 'dm') return <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Direktnachricht" />
  if (c.writeRole) return <Megaphone size={13} className="shrink-0 text-[var(--color-gold)]" aria-label="Ankündigungen" />
  if (c.visibility === 'privat') return <Lock size={13} className="shrink-0 text-[var(--color-muted)]" aria-label="Privat" />
  return <Hash size={13} className="shrink-0 text-[var(--color-muted)]" />
}

function Message({ m, meId, onReply, onEdit, onAct }: {
  m: ChatMessage
  meId?: string
  onReply: () => void
  onEdit: () => void
  onAct: (m: ChatMessage, b: Record<string, unknown>) => void
}) {
  const mine = m.authorId === meId
  if (m.deletedAt) {
    return <p className="pl-11 text-[11px] italic text-[var(--color-muted)]">Nachricht gelöscht</p>
  }
  return (
    <article className="group flex gap-3">
      {m.authorPicture
        ? <img src={m.authorPicture} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-paper-2)] text-xs">{(m.authorName || '?')[0]?.toUpperCase()}</div>}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-[var(--color-ink)]">{m.authorName || 'Unbekannt'}</span>
          <span className="text-[10px] text-[var(--color-muted)]">{fmtTime(m.createdAt)}</span>
          {m.editedAt && <span className="text-[10px] text-[var(--color-muted)]">(geändert)</span>}
          {m.pinned && <Pin size={9} className="text-[var(--color-gold)]" />}
        </div>

        {m.replyTo && m.replyToBody && (
          <p className="mt-0.5 border-l-2 border-[var(--color-line)] pl-2 text-[11px] text-[var(--color-muted)]">
            <strong>{m.replyToAuthor}:</strong> {messageExcerpt(m.replyToBody, 60)}
          </p>
        )}

        <p className="mt-0.5 text-sm whitespace-pre-wrap break-words text-[var(--color-ink-soft)]">{m.body}</p>

        {m.fileId && (
          <a href={`/api/workspace/files/${m.fileId}`} download className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px] hover:bg-[var(--color-hover)]">
            {m.fileName}
          </a>
        )}
      </div>

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Act icon={Reply} label="Antworten" onClick={onReply} />
        <Act icon={CheckSquare} label="Als Aufgabe" onClick={() => onAct(m, { action: 'toTask' })} />
        <Act icon={StickyNote} label="Als Notiz" onClick={() => onAct(m, { action: 'toNote' })} />
        <Act icon={Pin} label={m.pinned ? 'Lösen' : 'Anheften'} onClick={() => onAct(m, { action: m.pinned ? 'unpin' : 'pin' })} />
        {mine && <Act icon={Pencil} label="Ändern" onClick={onEdit} />}
        {mine && <Act icon={Trash2} label="Löschen" danger onClick={() => onAct(m, { action: 'delete' })} />}
      </div>
    </article>
  )
}

function Act({ icon: Icon, label, onClick, danger }: { icon: typeof Reply; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`rounded-md p-1.5 transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]'}`}>
      <Icon size={12} />
    </button>
  )
}

function NewDialog({ users, meId, meRole, onDm, onCreated, onClose }: {
  users: { id: string; name?: string; email: string }[]
  meId: string
  meRole: string
  onDm: (id: string) => void
  onCreated: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isAdmin = meRole === 'admin' || meRole === 'owner'

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/workspace/chat/channels', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', name })
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Anlegen nicht möglich.'); setBusy(false); return }
      onCreated(d.channel.id)
    } catch {
      setError('Anlegen nicht möglich.')
      setBusy(false)
    }
  }

  const list = users.filter((u) => u.id !== meId && (u.name || u.email).toLowerCase().includes(q.toLowerCase()))

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" onClick={onClose}>
      <div className="card w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="font-display text-xl">Neue Unterhaltung</h2>
          <button onClick={onClose} aria-label="Schließen" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        <h3 className="mt-5 mb-2 text-xs font-medium text-[var(--color-muted)]">Direktnachricht</h3>
        <div className="relative">
          <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Person suchen …" className="inp pl-8 text-sm" />
        </div>
        <div className="mt-2 max-h-52 overflow-y-auto">
          {list.length === 0 && <p className="py-3 text-center text-xs text-[var(--color-muted)]">Niemand gefunden.</p>}
          {list.map((u) => (
            <button key={u.id} onClick={() => onDm(u.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--color-hover)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-paper-2)] text-[10px]">{(u.name || u.email)[0]?.toUpperCase()}</span>
              <span className="truncate">{u.name || u.email}</span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <>
            <h3 className="mt-5 mb-2 border-t border-[var(--color-line)] pt-4 text-xs font-medium text-[var(--color-muted)]">Neuer Kanal</h3>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Projekt Müller" className="inp text-sm" />
              <button onClick={create} disabled={busy || !name.trim()} className="btn-ink shrink-0 rounded-lg px-3 text-sm">Anlegen</button>
            </div>
          </>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const heute = new Date().toDateString() === d.toDateString()
  return heute
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
