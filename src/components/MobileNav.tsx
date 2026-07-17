'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Menu, X, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROLE_LABELS, type Role } from '@shared/auth'
import { Logo } from './Logo'
import { NotificationBell } from './NotificationBell'
import { visibleGroups, BOTTOM_NAV } from './nav/navConfig'
import { useNavData } from './nav/useNavData'
import { cls } from '@/lib/format'

/**
 * Vollständige mobile Navigation: feste Top-Bar, feste Bottom-Navigation und ein Vollmenü-Drawer.
 * Nur unter der Breite `lg` sichtbar — ab `lg` übernimmt die Desktop-Sidebar (Nav.tsx).
 *
 * Wichtig: kein bloßes Ausblenden der Sidebar. Jeder Navigationspunkt der Desktop-Version ist
 * hier über Bottom-Nav oder „Mehr" erreichbar, rollenbasiert wie am Desktop.
 */
export function MobileNav() {
  return (
    <Suspense fallback={<TopBarShell />}>
      <MobileNavInner />
    </Suspense>
  )
}

function TopBarShell() {
  // Platzhalter in exakt der Top-Bar-Höhe — verhindert einen Layoutsprung beim Hydrieren.
  return <div aria-hidden className="h-[calc(3.25rem+env(safe-area-inset-top))] lg:hidden" />
}

function MobileNavInner() {
  const path = usePathname()
  const params = useSearchParams()
  const view = params.get('view') || ''
  const { me, counts } = useNavData(path)
  const [open, setOpen] = useState(false)

  const role = me?.user?.role as Role | undefined
  const groups = visibleGroups(role)

  // Beim Seitenwechsel das Menü schließen — sonst bleibt es nach einem Tippen offen stehen.
  useEffect(() => { setOpen(false) }, [path, view])

  // Hintergrund sperren, solange das Menü offen ist.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <>
      {/* ── Feste Top-Bar ── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.25rem+env(safe-area-inset-top))] items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Menü öffnen"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-ink-soft)] active:bg-[var(--color-hover)]"
        >
          <Menu size={22} />
        </button>
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
          <Logo className="h-7 shrink-0" />
          <span className="truncate font-display text-[17px]">LL Studio</span>
        </Link>
        {me?.authenticated && <NotificationBell authenticated placement="down" />}
      </header>
      {/* Abstandshalter, damit Inhalt nicht unter der Top-Bar liegt. */}
      <div aria-hidden className="h-[calc(3.25rem+env(safe-area-inset-top))] lg:hidden" />

      {/* ── Drawer (Vollmenü) ── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-[var(--color-surface)] pt-[env(safe-area-inset-top)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Logo className="h-7" />
                <span className="font-display text-[17px]">LL Studio</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Menü schließen" className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-muted)] active:bg-[var(--color-hover)]">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
              {groups.map((g) => (
                <div key={g.title} className="mb-4">
                  <div className="mb-1 px-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">{g.title}</div>
                  <div className="flex flex-col gap-0.5">
                    {g.links.map((l) => (
                      <DrawerLink key={l.href} href={l.href} label={l.label} icon={l.icon} active={l.active(path, view)} count={l.count?.(counts)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Benutzerbereich + Abmelden */}
            <div className="border-t border-[var(--color-line)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {me?.authenticated && me.user ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold-soft)] text-[13px] font-semibold text-[var(--color-ink)]">
                    {(me.user.name || me.user.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">{me.user.name || me.user.email}</div>
                    <div className="truncate text-[11px] text-[var(--color-muted)]">{ROLE_LABELS[me.user.role as Role] ?? '—'}</div>
                  </div>
                  <button onClick={() => signOut({ redirectTo: '/login' })} aria-label="Abmelden" className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-muted)] active:bg-[var(--color-hover)]">
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <div className="px-2 py-2 text-[12px] text-[var(--color-muted)]">{me?.configured === false ? 'Lokaler Modus · nicht angemeldet' : 'Nicht angemeldet'}</div>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* ── Feste Bottom-Navigation ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {BOTTOM_NAV.map((b) => {
          const active = b.active?.(path, view) ?? false
          const badge = b.href === '/workspace/chat' ? counts.chatUnread : 0
          const content = (
            <>
              <span className="relative">
                <b.icon size={21} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-[var(--color-gold)]' : 'text-[var(--color-ink-soft)]'} />
                {badge > 0 && <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-gold)] px-1 text-[9px] font-medium text-white">{badge > 9 ? '9+' : badge}</span>}
              </span>
              <span className={cls('text-[10px]', active ? 'font-medium text-[var(--color-ink)]' : 'text-[var(--color-muted)]')}>{b.label}</span>
            </>
          )
          const className = 'flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 active:bg-[var(--color-hover)]'
          return b.isMore ? (
            <button key={b.label} onClick={() => setOpen(true)} aria-label="Weitere Navigation" className={className}>{content}</button>
          ) : (
            <Link key={b.label} href={b.href!} prefetch={false} aria-current={active ? 'page' : undefined} className={className}>{content}</Link>
          )
        })}
      </nav>
      {/* Abstandshalter, damit Inhalt nicht unter der Bottom-Nav endet. */}
      <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden" />
    </>
  )
}

function DrawerLink({ href, label, icon: Icon, active, count }: { href: string; label: string; icon: LucideIcon; active: boolean; count?: number }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cls(
        'flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[14px] transition-colors',
        active ? 'bg-[var(--color-gold-soft)]/45 font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] active:bg-[var(--color-hover)]'
      )}
    >
      <Icon size={19} strokeWidth={1.8} className={active ? 'text-[var(--color-gold)]' : 'text-[var(--color-gold)]/80'} />
      <span className="flex-1 truncate">{label}</span>
      {count != null && count > 0 && (
        <span className="rounded-md bg-[var(--color-paper-2)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--color-muted)]">{count > 999 ? '999+' : count}</span>
      )}
    </Link>
  )
}
