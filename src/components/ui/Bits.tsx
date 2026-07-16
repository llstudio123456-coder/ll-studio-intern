import type { ReactNode } from 'react'
import { cls } from '@/lib/format'

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'ink' | 'soft'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--color-paper-2)] text-[var(--color-ink-soft)]',
    gold: 'bg-[var(--color-gold-soft)] text-[var(--color-gold)]',
    ink: 'bg-[var(--color-ink)] text-[var(--color-paper)]',
    soft: 'border border-[var(--color-line)] text-[var(--color-muted)]'
  }
  return (
    <span className={cls('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}

export function ColorSwatches({ colors }: { colors: { hex: string }[] }) {
  if (!colors.length) return <span className="text-xs text-[var(--color-muted)]">—</span>
  return (
    <div className="flex items-center gap-1.5">
      {colors.slice(0, 6).map((c, i) => (
        <span key={i} title={c.hex} className="h-5 w-5 rounded-md border border-black/10" style={{ background: c.hex }} />
      ))}
    </div>
  )
}

export function DisclaimerBar({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
      <span className="mt-0.5">⚠️</span>
      <span>{text}</span>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-[var(--color-muted)] uppercase">{title}</h3>
      {children}
    </div>
  )
}
