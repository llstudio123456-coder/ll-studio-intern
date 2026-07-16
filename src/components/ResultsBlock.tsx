'use client'
import { useMemo, useState, type ReactNode } from 'react'
import type { CompetitorAnalysis, InspirationReport, SortMode } from '@shared/types'
import { ResultCard } from './ResultCard'
import { ResultDetail } from './ResultDetail'
import { InspirationSummary } from './InspirationSummary'
import { ExportBar } from './ExportBar'
import { SORT_OPTIONS } from '@/lib/categories'

const SORT_KEY: Record<SortMode, (c: CompetitorAnalysis) => number> = {
  score: (c) => c.score.total,
  aesthetic: (c) => c.score.breakdown.designQuality,
  modern: (c) => c.score.breakdown.modernity,
  structure: (c) => c.score.breakdown.structure,
  mobile: (c) => c.score.breakdown.mobile,
  inspiration: (c) => c.score.breakdown.inspirationValue,
  relevance: (c) => c.queryRelevance ?? 0
}

export function ResultsBlock({
  results,
  report,
  projectId,
  learnLabel,
  liveMode = false,
  onReset,
  header
}: {
  results: CompetitorAnalysis[]
  report?: InspirationReport
  projectId?: string
  learnLabel?: string
  liveMode?: boolean
  onReset?: () => void
  header?: ReactNode
}) {
  const [selected, setSelected] = useState<CompetitorAnalysis | null>(null)
  const [minScore, setMinScore] = useState(0)
  const [industry, setIndustry] = useState('')
  const [style, setStyle] = useState('')
  const [sort, setSort] = useState<SortMode>('score')

  const industries = useMemo(() => uniq(results.map((c) => c.snapshot.industry)), [results])
  const styles = useMemo(() => uniq(results.map((c) => c.snapshot.designStyle)), [results])

  const view = useMemo(() => {
    const f = results.filter((c) => {
      if (c.score.total < minScore) return false
      if (industry && c.snapshot.industry !== industry) return false
      if (style && c.snapshot.designStyle !== style) return false
      return true
    })
    const key = SORT_KEY[sort]
    return [...f].sort((a, b) => key(b) - key(a))
  }, [results, minScore, industry, style, sort])

  if (results.length === 0) return null

  return (
    <div className="space-y-5">
      {header}
      {projectId && <ExportBar projectId={projectId} onReset={onReset} />}
      {report && <InspirationSummary r={report} learnLabel={learnLabel} />}

      {!liveMode && (
        <div className="card flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-[170px] flex-1">
            <Label>Mindest-Score: {minScore}</Label>
            <input type="range" min={0} max={100} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
          </div>
          <Picker label="Branche" value={industry} setValue={setIndustry} options={industries} />
          <Picker label="Stil" value={style} setValue={setStyle} options={styles} />
          <div>
            <Label>Sortierung</Label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="inp min-w-[180px]">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-xl">
          {liveMode ? 'Live-Ergebnisse' : 'Beste Webseiten'} <span className="text-[var(--color-muted)]">({view.length})</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {view.map((c, i) => (
            <ResultCard key={c.id} c={c} rank={i + 1} onOpen={() => setSelected(c)} />
          ))}
        </div>
      </div>

      {selected && <ResultDetail c={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function uniq(arr: (string | undefined)[]): string[] {
  return Array.from(new Set(arr.filter(Boolean))) as string[]
}
function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{children}</span>
}
function Picker({ label, value, setValue, options }: { label: string; value: string; setValue: (v: string) => void; options: string[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => setValue(e.target.value)} className="inp min-w-[150px]">
        <option value="">alle</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}
