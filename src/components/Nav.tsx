'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import {
  Users, ChevronRight, Search, ClipboardList, Phone, Ban, History as HistoryIcon,
  SlidersHorizontal, LogOut, LayoutGrid
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROLE_LABELS, type Role } from '@shared/auth'
import { Logo } from './Logo'
import { NotificationBell } from './NotificationBell'
import { visibleGroups, type NavCounts, type NavLink } from './nav/navConfig'
import { useNavData } from './nav/useNavData'
import { cls } from '@/lib/format'

/* ── Kundenfinder-Ansichten (Query-Param statt langer Tab-Leiste; nur Desktop) ── */
const KF_SUB: { view: string; label: string; icon: LucideIcon; count?: keyof NavCounts }[] = [
  { view: 'uebersicht', label: 'Übersicht', icon: LayoutGrid },
  { view: 'finden', label: 'Unternehmen finden', icon: Search },
  { view: 'ergebnisse', label: 'Ergebnisse', icon: ClipboardList },
  { view: 'nachrecherche', label: 'Nachrecherche', icon: Phone },
  { view: 'ausschluss', label: 'Ausschlussliste', icon: Ban },
  { view: 'verlauf', label: 'Suchverlauf', icon: HistoryIcon },
  { view: 'einstellungen', label: 'Import & Pflege', icon: SlidersHorizontal }
]

function Counter({ n }: { n?: number }) {
  if (n == null || n === 0) return null
  return <span className="ml-auto rounded-md bg-[var(--color-paper-2)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--color-muted)] group-aria-[current=page]:bg-[var(--color-gold-soft)] group-aria-[current=page]:text-[var(--color-ink-soft)]">{n > 999 ? '999+' : n}</span>
}

/**
 * Desktop-Seitenleiste (ab lg). Nutzt dieselbe Navigationskonfiguration und denselben Daten-Hook
 * wie die mobile Navigation (MobileNav) — die Menüpunkte können deshalb nicht auseinanderlaufen.
 * Einzige Desktop-Besonderheit: der Kundenfinder ist hier als aufklappbarer Bereich mit
 * Unteransichten dargestellt.
 */
export function Nav() {
  const path = usePathname()
  const params = useSearchParams()
  const view = params.get('view') || ''
  const { me, counts } = useNavData(path)

  const inKf = path === '/kundenfinder'
  const [kfOpen, setKfOpen] = useState(true)
  useEffect(() => { if (inKf) setKfOpen(true) }, [inKf])

  const role = me?.user?.role as Role | undefined
  const groups = visibleGroups(role)

  const Item = (l: NavLink & { indent?: boolean }) => (
    <Link
      href={l.href}
      // Kein Prefetch: Jede Seite ist geschützt. Ein Prefetch vor der Freigabe bekäme von der
      // Middleware nur eine Weiterleitung, die im Router-Cache landet (siehe Login-Fix).
      prefetch={false}
      aria-current={l.active(path, view) ? 'page' : undefined}
      className={cls(
        'group relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] transition-colors',
        l.indent ? 'pr-2.5 pl-8' : 'px-2.5',
        l.active(path, view) ? 'bg-[var(--color-gold-soft)]/45 font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-hover)]'
      )}
    >
      {l.active(path, view) && <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-gold)]" />}
      <l.icon size={l.indent ? 15 : 17} strokeWidth={1.75} className={l.active(path, view) ? 'text-[var(--color-gold)]' : 'text-[var(--color-gold)]/80'} />
      <span className="truncate">{l.label}</span>
      <Counter n={l.count?.(counts)} />
    </Link>
  )

  const kfActive = (v: string) => inKf && ((view || 'ergebnisse') === v || (!view && v === 'ergebnisse'))

  return (
    <aside className="sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-5 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <Logo className="h-9" />
        <div className="leading-tight">
          <div className="font-display text-[18px]">LL Studio</div>
          <div className="-mt-0.5 text-[9.5px] font-semibold tracking-[0.2em] text-[var(--color-muted)] uppercase">Internes Tool</div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1 px-2.5 text-[10px] font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">{g.title}</div>
            <div className="flex flex-col gap-0.5">
              {g.links.map((l) => {
                // Der Kundenfinder-Eintrag wird auf dem Desktop durch den aufklappbaren Bereich ersetzt.
                if (l.href === '/kundenfinder') {
                  return (
                    <div key="kf">
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
                            <Link
                              key={s.view}
                              href={`/kundenfinder?view=${s.view}`}
                              prefetch={false}
                              aria-current={kfActive(s.view) ? 'page' : undefined}
                              className={cls(
                                'group relative flex items-center gap-2.5 rounded-lg py-2 pr-2.5 pl-8 text-[13px] transition-colors',
                                kfActive(s.view) ? 'bg-[var(--color-gold-soft)]/45 font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-hover)]'
                              )}
                            >
                              <s.icon size={15} strokeWidth={1.75} className={kfActive(s.view) ? 'text-[var(--color-gold)]' : 'text-[var(--color-gold)]/80'} />
                              <span className="truncate">{s.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return <Item key={l.href} {...l} indent={l.href === '/admin/freigaben'} />
              })}
            </div>
          </div>
        ))}
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
              <div className="truncate text-[10px] text-[var(--color-muted)]">{ROLE_LABELS[me.user.role as Role] ?? '—'}</div>
            </div>
            <NotificationBell authenticated={!!me?.authenticated} />
            <button onClick={() => signOut({ redirectTo: '/login' })} title="Abmelden" className="btn-icon p-1.5 text-[var(--color-muted)]"><LogOut size={15} /></button>
          </div>
        ) : (
          <div className="px-2 text-[11px] text-[var(--color-muted)]">{me?.configured === false ? 'Lokaler Modus · nicht angemeldet' : 'Nicht angemeldet'}</div>
        )}
      </div>
    </aside>
  )
}
