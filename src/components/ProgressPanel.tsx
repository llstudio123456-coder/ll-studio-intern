'use client'
import { Loader2, Check } from 'lucide-react'
import type { ProgressEvent, PipelinePhase } from '@shared/types'

const ORDER: PipelinePhase[] = ['init', 'target', 'queries', 'search', 'collect', 'analyze-competitors', 'scoring', 'report', 'done']

export function ProgressPanel({
  progress,
  phases,
  extra
}: {
  progress: ProgressEvent
  phases: { key: PipelinePhase; label: string }[]
  extra?: string
}) {
  const curIdx = ORDER.indexOf(progress.phase)
  return (
    <div className="card p-6 fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {progress.phase === 'done' ? (
            <Check size={18} className="text-[var(--color-gold)]" />
          ) : progress.phase === 'error' ? (
            <span className="text-red-500">✕</span>
          ) : (
            <Loader2 size={18} className="animate-spin text-[var(--color-gold)]" />
          )}
          <span className="text-sm font-medium">{progress.message}</span>
        </div>
        <span className="text-sm tabular-nums text-[var(--color-muted)]">{progress.percent}%</span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
        <div className="h-full rounded-full bg-[var(--color-ink)] transition-all duration-500" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {phases.map((p) => {
          const idx = ORDER.indexOf(p.key)
          const done = curIdx > idx || progress.phase === 'done'
          const active = progress.phase === p.key || (p.key === 'analyze-competitors' && progress.phase === 'scoring')
          return (
            <span
              key={p.key}
              className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ' +
                (done ? 'bg-[var(--color-gold-soft)] text-[var(--color-gold)]' : active ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'border border-[var(--color-line)] text-[var(--color-muted)]')
              }
            >
              {done && <Check size={12} />} {p.label}
            </span>
          )
        })}
      </div>
      {extra && <div className="mt-4 text-xs text-[var(--color-muted)]">{extra}</div>}
    </div>
  )
}
