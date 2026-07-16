import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Info, AlertTriangle, Inbox } from 'lucide-react'
import { cls } from '@/lib/format'

/** Einheitlicher Seitenkopf: Kategorie · Serif-Titel · Unterzeile · optionale Aktion rechts. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  icon: Icon
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--color-gold)] uppercase">{eyebrow}</div>}
        <h1 className="flex items-center gap-2.5 font-display text-[28px] leading-tight">
          {Icon && <Icon size={24} strokeWidth={1.6} className="text-[var(--color-gold)]" />}
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  )
}

/** Kompakte Abschnittsüberschrift innerhalb einer Seite. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-[var(--color-ink-soft)]">{title}</h2>
      {action}
    </div>
  )
}

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'gold'

/** Status-Badge mit dezentem, zugänglichem Farbsystem + optionalem Statuspunkt. */
export function StatusBadge({ label, tone = 'neutral', dot = true }: { label: string; tone?: Tone; dot?: boolean }) {
  return <span className={cls('badge', `badge-${tone}`, dot && 'badge-dot')}>{label}</span>
}

/** Score-Badge: kompakte Kennzahl, Farbe je nach Wert/Richtung. */
export function ScoreBadge({
  value,
  max = 100,
  /** 'high' = hoher Wert ist gut (grün), 'low' = hoher Wert ist schlecht/hohes Potenzial (rot) */
  direction = 'high',
  suffix
}: {
  value?: number | null
  max?: number
  direction?: 'high' | 'low'
  suffix?: string
}) {
  if (value == null) return <span className="text-xs text-[var(--color-muted)]">—</span>
  const pct = value / max
  const good = direction === 'high' ? pct >= 0.6 : pct < 0.35
  const bad = direction === 'high' ? pct < 0.35 : pct >= 0.6
  const tone: Tone = good ? 'success' : bad ? 'error' : 'warning'
  return (
    <span className={cls('badge tabular-nums', `badge-${tone}`)}>
      {value}
      {suffix ?? ''}
    </span>
  )
}

/** Kennzahl-Kachel fürs Dashboard. */
export function Metric({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="card-flat p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</span>
        {Icon && <Icon size={16} strokeWidth={1.75} className="text-[var(--color-gold)]" />}
      </div>
      <div className="mt-1.5 font-display text-3xl leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  )
}

/** Hochwertiger, dezenter Info-Hinweis. */
export function InfoBanner({ children, tone = 'info', icon }: { children: ReactNode; tone?: 'info' | 'gold' | 'warning'; icon?: LucideIcon }) {
  const map = {
    info: { cls: 'border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]', Icon: icon || Info, ic: 'text-[var(--color-gold)]' },
    gold: { cls: 'border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 text-[var(--color-ink-soft)]', Icon: icon || Info, ic: 'text-[var(--color-gold)]' },
    warning: { cls: 'border-amber-300/60 bg-amber-50/70 text-amber-800', Icon: icon || AlertTriangle, ic: 'text-amber-600' }
  }[tone]
  const Ic = map.Icon
  return (
    <div className={cls('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed', map.cls)}>
      <Ic size={15} className={cls('mt-0.5 shrink-0', map.ic)} />
      <span>{children}</span>
    </div>
  )
}

/** Professioneller Leerzustand. */
export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-paper-2)] text-[var(--color-muted)]">
        <Icon size={20} strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-sm font-medium text-[var(--color-ink)]">{title}</div>
        {description && <div className="mt-1 max-w-sm text-xs text-[var(--color-muted)]">{description}</div>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

/** Skeleton-Zeilen für Ladezustände in Tabellen/Listen. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cls('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-11 w-full" />
      ))}
    </div>
  )
}
