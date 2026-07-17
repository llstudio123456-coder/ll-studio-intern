'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, Link2, Sparkles, Eye, Users, FileText, Wand2, Settings, ChevronRight,
  Search, ClipboardList, Phone, Ban, History as HistoryIcon, Save, Layers, SlidersHorizontal, LogOut, LayoutGrid,
  ShieldCheck, HardDrive, MailPlus, StickyNote, CheckSquare, MessageSquare
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { roleAtLeast, type Role } from '@shared/auth'
import { Logo } from './Logo'
import { cls } from '@/lib/format'

/* ── Kundenfinder-Ansichten (Query-Param statt langer Tab-Leiste) ── */
const KF_SUB: { view: string; label: string; icon: LucideIcon; count?: keyof Counts }[] = [
  { view: 'uebersicht', label: 'Übersicht', icon: LayoutGrid },
  { view: 'finden', label: 'Unternehmen finden', icon: Search },
  { view: 'ergebnisse', label: 'Ergebnisse', icon: ClipboardList, count: 'ergebnisse' },
  { view: 'nachrecherche', label: 'Nachrecherche', icon: Phone, count: 'nachrecherche' },
  { view: 'ausschluss', label: 'Ausschlussliste', icon: Ban },
  { view: 'verlauf', label: 'Suchverlauf', icon: HistoryIcon },
  { view: 'einstellungen', label: 'Import & Pflege', icon: SlidersHorizontal }
]

interface Counts { ergebnisse: number; nachrecherche: number; gespeichert: number; pipeline: number }

function Counter({ n }: { n?: number }) {
  if (n == null) return null
  return <span className="ml-auto rounded-md bg-[var(--color-paper-2)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--color-muted)] group-aria-[current=page]:bg-[var(--color-gold-soft)] group-aria-[current=page]:text-[var(--color-ink-soft)]">{n > 999 ? '999+' : n}</span>
}

export function Nav() {
  const path = usePathname()
  const params = useSearchParams()
  const view = params.get('view') || ''
  const [counts, setCounts] = useState<Counts | null>(null)
  const [me, setMe] = useState<{ configured: boolean; authenticated: boolean; user?: { name?: string; email?: string; role?: string } | null } | null>(null)
  const inKf = path === '/kundenfinder'
  const [kfOpen, setKfOpen] = useState(true)

  useEffect(() => { if (inKf) setKfOpen(true) }, [inKf])

  const loadCounts = useCallback(() => {
    fetch('/api/kundenfinder/companies?stats=1&limit=1')
      .then((r) => r.json())
      .then((d) => { if (d.stats) setCounts({ ergebnisse: d.stats.qualifiziert ?? 0, nachrecherche: d.stats.nachrecherche ?? 0, gespeichert: d.stats.gespeichert ?? 0, pipeline: d.stats.gespeichert ?? 0 }) })
      .catch(() => {})
  }, [])
  useEffect(() => { loadCounts() }, [loadCounts, path, view])
  useEffect(() => { fetch('/api/auth/me').then((r) => r.json()).then(setMe).catch(() => {}) }, [])

  // Ungelesene Chatnachrichten im Menü. Der Echtzeit-Strom hält die Zahl aktuell, ohne dass
  // jemand die Seite neu laden muss — er liefert nur Ereignisse aus erlaubten Kanälen.
  const [chatUnread, setChatUnread] = useState(0)
  const loadChatUnread = useCallback(() => {
    fetch('/api/workspace/chat/channels')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.channels) setChatUnread(d.channels.reduce((n: number, c: { unread?: number }) => n + (c.unread || 0), 0)) })
      .catch(() => {})
  }, [])
  useEffect(() => { loadChatUnread() }, [loadChatUnread, path])
  useEffect(() => {
    if (!me?.authenticated) return
    const es = new EventSource('/api/workspace/chat/stream')
    const onAny = () => loadChatUnread()
    es.addEventListener('message', onAny)
    es.addEventListener('delete', onAny)
    return () => es.close()
  }, [me?.authenticated, loadChatUnread])

  // roleAtLeast statt Gleichheit: Der Inhaber ist ranghöher als ein Admin und muss den
  // Adminbereich ebenfalls sehen. Das Ausblenden ist reine Bequemlichkeit — die Prüfung
  // sitzt serverseitig in guardAdmin und in der Middleware.
  const isAdmin = roleAtLeast(me?.user?.role as Role | undefined, 'admin')

  // Top-Level-Link
  const Item = ({ href, label, icon: Icon, active, count, indent }: { href: string; label: string; icon: LucideIcon; active: boolean; count?: number; indent?: boolean }) => (
    <Link
      href={href}
      // Kein Prefetch: Jede Seite hier ist geschützt. Ein Prefetch VOR der Freigabe bekommt von
      // der Middleware nur eine Weiterleitung zur Passwortseite — und genau die landete im
      // Client Router Cache und ließ den Login „nicht reagieren", bis manuell neu geladen wurde.
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cls(
        'group relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] transition-colors',
        indent ? 'pr-2.5 pl-8' : 'px-2.5',
        active ? 'bg-[var(--color-gold-soft)]/45 font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-hover)]'
      )}
    >
      {active && <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-gold)]" />}
      <Icon size={indent ? 15 : 17} strokeWidth={1.75} className={active ? 'text-[var(--color-gold)]' : 'text-[var(--color-gold)]/80'} />
      <span className="truncate">{label}</span>
      {count != null && <Counter n={count} />}
    </Link>
  )

  const top = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) && href !== '/kundenfinder')
  const kfActive = (v: string) => inKf && ((view || 'ergebnisse') === v || (!view && v === 'ergebnisse'))

  return (
    <aside className="sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-5 sm:flex">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <Logo className="h-9" />
        <div className="leading-tight">
          <div className="font-display text-[18px]">LL Studio</div>
          <div className="-mt-0.5 text-[9.5px] font-semibold tracking-[0.2em] text-[var(--color-muted)] uppercase">Internes Tool</div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {/* Arbeitsbereich */}
        <Group title="Arbeitsbereich">
          <Item href="/" label="Dashboard" icon={LayoutDashboard} active={top('/')} />
        </Group>

        {/* Analyse */}
        <Group title="Analyse">
          <Item href="/url-analyse" label="URL-Analyse" icon={Link2} active={top('/url-analyse')} />
          <Item href="/inspiration" label="Inspirationssuche" icon={Sparkles} active={top('/inspiration')} />
          <Item href="/design-preview" label="Stil-Vorschau" icon={Eye} active={top('/design-preview')} />
        </Group>

        {/* Kundengewinnung */}
        <Group title="Kundengewinnung">
          {/* Kundenfinder: aufklappbarer Bereich */}
          <button
            onClick={() => setKfOpen((o) => !o)}
            className={cls('group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors', inKf ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-hover)]')}
            aria-expanded={kfOpen}
          >
            <Users size={17} strokeWidth={1.75} className="text-[var(--color-gold)]/80" />
            <span className="font-medium">Kundenfinder</span>
            <ChevronRight size={14} className={cls('ml-auto text-[var(--color-muted)] transition-transform', kfOpen && 'rotate-90')} />
          </button>
          {kfOpen && (
            <div className="mt-0.5 flex flex-col gap-0.5 border-l border-[var(--color-line)] pl-1">
              {KF_SUB.map((s) => (
                <Item key={s.view} href={`/kundenfinder?view=${s.view}`} label={s.label} icon={s.icon} active={kfActive(s.view)} count={s.count && counts ? counts[s.count] : undefined} indent />
              ))}
            </div>
          )}
          <Item href="/kundenfinder?view=gespeichert" label="Gespeicherte Kunden" icon={Save} active={inKf && view === 'gespeichert'} count={counts?.gespeichert} />
          <Item href="/kundenfinder?view=pipeline" label="Kontakt-Pipeline" icon={Layers} active={inKf && view === 'pipeline'} count={counts?.pipeline} />
          <Item href="/reports" label="Reports" icon={FileText} active={top('/reports')} />
        </Group>

        {/* Werkzeuge */}
        <Group title="Werkzeuge">
          <Item href="/prompt-generator" label="Prompt-Generator" icon={Wand2} active={top('/prompt-generator')} />
        </Group>

        {/* Workspace */}
        <Group title="Workspace">
          <Item href="/workspace" label="Dateien" icon={HardDrive} active={path === '/workspace'} />
          <Item href="/workspace/notizen" label="Notizen" icon={StickyNote} active={path.startsWith('/workspace/notizen')} />
          <Item href="/workspace/aufgaben" label="Aufgaben" icon={CheckSquare} active={path.startsWith('/workspace/aufgaben')} />
          <Item href="/workspace/chat" label="Chat" icon={MessageSquare} active={path.startsWith('/workspace/chat')} count={chatUnread || undefined} />
        </Group>

        {/* System */}
        <Group title="System">
          <Item href="/settings" label="Einstellungen" icon={Settings} active={top('/settings')} />
          {isAdmin && <Item href="/admin" label="Benutzer & Sicherheit" icon={ShieldCheck} active={path === '/admin'} />}
          {isAdmin && <Item href="/admin/freigaben" label="E-Mail-Freigaben" icon={MailPlus} active={path.startsWith('/admin/freigaben')} indent />}
        </Group>
      </nav>

      {/* Benutzerbereich */}
      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        {me?.authenticated && me.user ? (
          <div className="flex items-center gap-2.5 px-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold-soft)] text-[12px] font-semibold text-[var(--color-ink)]">
              {(me.user.name || me.user.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-medium text-[var(--color-ink)]">{me.user.name || me.user.email}</div>
              <div className="truncate text-[10px] text-[var(--color-muted)]">{me.user.role === 'admin' ? 'Administrator' : me.user.role === 'viewer' ? 'Nur Lesen' : 'Mitarbeiter'}</div>
            </div>
            <button onClick={() => signOut({ redirectTo: '/login' })} title="Abmelden" className="btn-icon p-1.5 text-[var(--color-muted)]"><LogOut size={15} /></button>
          </div>
        ) : (
          <div className="px-2 text-[11px] text-[var(--color-muted)]">{me?.configured === false ? 'Lokaler Modus · nicht angemeldet' : 'Nicht angemeldet'}</div>
        )}
      </div>
    </aside>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-2.5 text-[10px] font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}
