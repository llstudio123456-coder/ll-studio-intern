'use client'
import { useState } from 'react'
import { Play, Settings2, Search, Link2 } from 'lucide-react'
import type { ManualUrlInput } from '@shared/types'
import { useUrlStore } from '@/lib/stores/urlStore'
import { ProgressPanel } from '@/components/ProgressPanel'
import { TargetSummary } from '@/components/TargetSummary'
import { QueriesPanel } from '@/components/QueriesPanel'
import { ResultsBlock } from '@/components/ResultsBlock'
import { ManualUrls } from '@/components/ManualUrls'
import { DisclaimerBar } from '@/components/ui/Bits'
import { PageHeader } from '@/components/ui/Ui'

const STYLES = ['modern', 'clean', 'premium', 'elegant', 'luxuriös', 'minimalistisch', 'handwerklich']
const PHASES = [
  { key: 'target' as const, label: 'Zielseite' },
  { key: 'queries' as const, label: 'Suchanfragen' },
  { key: 'search' as const, label: 'Web-Suche' },
  { key: 'analyze-competitors' as const, label: 'Konkurrenz' },
  { key: 'report' as const, label: 'Report' }
]

export default function UrlAnalysePage() {
  const { config, setConfig, running, progress, error, project, liveTarget, liveQueries, liveComp, start, reset } = useUrlStore()
  const [showOpts, setShowOpts] = useState(false)
  const set = (p: Partial<typeof config>) => setConfig(p)

  const target = project?.target ?? liveTarget
  const queries = project?.queries ?? liveQueries
  const competitors = project?.competitors ?? liveComp
  const noResults = project && project.competitors.length === 0

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <PageHeader
        eyebrow="Kundenanalyse"
        icon={Link2}
        title="URL Analyse"
        subtitle="Eine Kunden-Webseite analysieren und passende Mitbewerber bzw. visuelle Inspiration finden."
      />

      {running && (
        <div className="rounded-lg border border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          Analyse läuft im Hintergrund weiter – du kannst die Tabs wechseln, ohne sie zu unterbrechen.
        </div>
      )}

      <div className="card p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              value={config.url}
              onChange={(e) => set({ url: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && !running && start()}
              placeholder="z. B. www.musterbetrieb.de"
              className="h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] pr-4 pl-11 text-[15px] outline-none focus:border-[var(--color-gold)]"
            />
          </div>
          <button onClick={() => start()} disabled={running} className="btn-ink inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-medium">
            <Play size={17} /> {running ? 'Analyse läuft …' : 'Analyse starten'}
          </button>
        </div>

        <button onClick={() => setShowOpts((s) => !s)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          <Settings2 size={15} /> Erweiterte Optionen
        </button>

        {showOpts && (
          <div className="mt-4 grid gap-4 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Anzahl Ergebnisse">
              <select value={config.maxResults} onChange={(e) => set({ maxResults: Number(e.target.value) })} className="inp">
                {[5, 10, 20].map((n) => <option key={n} value={n}>{n} Ergebnisse</option>)}
              </select>
            </Field>
            <Field label="Land"><input className="inp" value={config.country} onChange={(e) => set({ country: e.target.value })} /></Field>
            <Field label="Region / Stadt"><input className="inp" placeholder="z. B. Köln" value={config.region} onChange={(e) => set({ region: e.target.value })} /></Field>
            <Field label="Radius"><input className="inp" placeholder="z. B. 25 km" value={config.radius} onChange={(e) => set({ radius: e.target.value })} /></Field>
            <Field label="Gewünschter Stil">
              <select className="inp" value={config.style} onChange={(e) => set({ style: e.target.value })}>
                <option value="">automatisch</option>
                {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Branche überschreiben"><input className="inp" value={config.industryOverride} onChange={(e) => set({ industryOverride: e.target.value })} /></Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <ManualUrls urls={config.manualUrls} onChange={(u: ManualUrlInput[]) => set({ manualUrls: u })} />
              <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <input type="checkbox" checked={!!config.manualSearchOnly} onChange={(e) => set({ manualSearchOnly: e.target.checked })} />
                Nur manuelle URLs analysieren (keine automatische Suche)
              </label>
            </div>
          </div>
        )}
      </div>

      {error && <div className="card border-red-300/60 bg-red-50/60 p-4 text-sm text-red-700">{error}</div>}
      {progress && <ProgressPanel progress={progress} phases={PHASES} extra={liveTarget ? `Branche: ${liveTarget.industry} · ${competitors.length} bewertet` : undefined} />}
      {target && <TargetSummary t={target} />}

      {noResults && (
        <div className="card border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/30 p-4 text-sm text-[var(--color-ink-soft)]">
          Keine automatischen Treffer. Öffne unten eine Suchanfrage, kopiere passende Webseiten und füge sie als manuelle URL ein.
        </div>
      )}
      {queries.length > 0 && (competitors.length === 0 || noResults) && <QueriesPanel queries={queries} />}

      {competitors.length > 0 && (
        <ResultsBlock
          results={competitors}
          report={project?.report}
          projectId={project?.id}
          learnLabel="Fehler der Zielseite vs. Mitbewerber"
          liveMode={!project}
          onReset={reset}
        />
      )}

      {!progress && !project && <DisclaimerBar text="Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren." />}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</span>
      {children}
    </label>
  )
}
