'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, AtSign, MessageSquare, CheckSquare, StickyNote, Megaphone, Clock } from 'lucide-react'
import { NOTIFICATION_LABELS, timeAgo, safeLink, type Notification, type NotificationKind } from '@shared/notifications'

const ICON: Record<NotificationKind, typeof Bell> = {
  mention: AtSign,
  dm: MessageSquare,
  task_assigned: CheckSquare,
  task_due: Clock,
  note_shared: StickyNote,
  announcement: Megaphone,
  channel_added: MessageSquare
}

/**
 * Glocke mit ungelesenen Benachrichtigungen.
 * Hängt am selben Echtzeit-Strom wie der Chat — neue Meldungen erscheinen ohne Neuladen.
 */
export function NotificationBell({ authenticated }: { authenticated: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetch('/api/workspace/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.ok) { setItems(d.notifications); setUnread(d.unread) } })
      .catch(() => {})
  }, [])

  useEffect(() => { if (authenticated) load() }, [authenticated, load])

  useEffect(() => {
    if (!authenticated) return
    const es = new EventSource('/api/workspace/chat/stream')
    const onNotify = () => load()
    es.addEventListener('notification', onNotify)
    return () => es.close()
  }, [authenticated, load])

  // Klick daneben schließt das Menü.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const openItem = async (n: Notification) => {
    await fetch('/api/workspace/notifications', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: n.id })
    }).catch(() => {})
    setOpen(false)
    load()
    // Doppelt geprüft: Der Server speichert nur interne Pfade, der Client folgt auch nur solchen.
    const ziel = safeLink(n.link)
    if (ziel) router.push(ziel)
  }

  const readAll = async () => {
    await fetch('/api/workspace/notifications', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'readAll' })
    }).catch(() => {})
    load()
  }

  if (!authenticated) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Benachrichtigungen (${unread} ungelesen)` : 'Benachrichtigungen'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-hover)]"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-gold)] px-1 text-[9px] font-medium tabular-nums text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 bottom-full z-50 mb-2 w-[320px] p-0 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2">
            <span className="text-xs font-medium">Benachrichtigungen</span>
            {unread > 0 && (
              <button onClick={readAll} className="flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                <Check size={11} /> Alle gelesen
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 && <p className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">Nichts Neues.</p>}
            {items.map((n) => {
              const Icon = ICON[n.kind] || Bell
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full items-start gap-2.5 border-b border-[var(--color-line)] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--color-hover)] ${
                    !n.readAt ? 'bg-[var(--color-gold)]/5' : ''
                  }`}
                >
                  <Icon size={13} className={`mt-0.5 shrink-0 ${!n.readAt ? 'text-[var(--color-gold)]' : 'text-[var(--color-muted)]'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-[var(--color-ink)]">{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-[11px] text-[var(--color-muted)]">{n.body}</span>}
                    <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
                      {NOTIFICATION_LABELS[n.kind]} · {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-gold)]" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
