'use client'
import { useEffect, useState } from 'react'
import { Sparkles, Search, Wand2, Zap, X, Play, Building2, EyeOff } from 'lucide-react'
import { PageHeader } from '@/components/ui/Ui'
import { useSearchStore } from '@/lib/stores/searchStore'
import { INDUSTRIES, STYLES, GOALS, FEATURES, REGIONS, QUICK_CHIPS } from '@/lib/categories'
import { ProgressPanel } from '@/components/ProgressPanel'
import { QueriesPanel } from '@/components/QueriesPanel'
import { ResultsBlock } from '@/components/ResultsBlock'
import { ManualUrls } from '@/components/ManualUrls'
import { cls } from '@/lib/format'

const PHASES = [
  { key: 'queries' as const, label: 'Suchanfragen' },
  { key: 'search' as const, label: 'Quellen' },
  { key: 'analyze-competitors' as const, label: 'Webseiten' },
  { key: 'report' as const, label: 'Report' }
]

export default function InspirationPage() {
  const s = useSearchStore()
  const {
    tab, query, industry, styles, goals, features, region, maxResults, manualUrls, manualSearchOnly,
    setField, running, progress, error, project, liveQueries, liveResults, start, reset
  } = s

  // ?q= aus Dashboard-Chips übernehmen (nur wenn noch nichts läuft/eingegeben)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q && !running && !project && !query) {
      setField('query', q)
      setField('tab', 'quick')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (key: 'styles' | 'goals' | 'features', value: string) => {
    const list = s[key]
    setField(key, list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const [showRejected, setShowRejected] = useState(false)
  const hasInput = query.trim() || industry || styles.length || manualUrls.length
  const queries = project?.queries ?? liveQueries
  const results = project?.results ?? liveResults
  const noResults = project && project.results.length === 0

  const activeChips: { label: string; clear: () => void }[] = [
    ...(industry ? [{ label: industry, clear: () => setField('industry', '') }] : []),
    ...styles.map((x) => ({ label: x, clear: () => setField('styles', styles.filter((v) => v !== x)) })),
    ...goals.map((x) => ({ label: x, clear: () => setField('goals', goals.filter((v) => v !== x)) })),
    ...features.map((x) => ({ label: x, clear: () => setField('features', features.filter((v) => v !== x)) })),
    ...(region && region !== 'Kein Regionsfilter' ? [{ label: region, clear: () => setField('region', 'Kein Regionsfilter') }] : [])
  ]

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <PageHeader
        eyebrow="Referenzen"
        icon={Sparkles}
        title="Inspiration Suche"
        subtitle="Finde optisch starke Webseiten – tippe einen Begriff oder klicke dich durch die Kategorien."
      />

      {running && (
        <div className="rounded-lg border border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          Suche läuft im Hintergrund weiter – du kannst die Tabs wechseln, ohne sie zu unterbrechen.
        </div>
      )}

      <div className="flex gap-2">
        <TabBtn active={tab === 'quick'} onClick={() => setField('tab', 'quick')} icon={<Zap size={15} />} label="Schnellsuche" />
        <TabBtn active={tab === 'guided'} onClick={() => setField('tab', 'guided')} icon={<Wand2 size={15} />} label="Geführte Suche" />
      </div>

      {tab === 'quick' ? (
        <div className="card p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                value={query}
                onChange={(e) => setField('query', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !running && start()}
                placeholder="z. B. „Restaurant ästhetisch“ oder „Zahnarzt modern premium Köln“"
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] py-3.5 pr-4 pl-11 text-[15px] outline-none focus:border-[var(--color-gold)]"
              />
            </div>
            <button onClick={() => start()} disabled={running} className="btn-ink inline-flex h-[52px] items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-medium">
              <Play size={17} /> {running ? 'Suche läuft …' : 'Suche starten'}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_CHIPS.map((c) => (
              <button key={c} onClick={() => start(c)} disabled={running} className="chip rounded-full px-3.5 py-1.5 text-sm">
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Wizard step={1} title="Welche Branche?">
            <SingleGroup options={INDUSTRIES} value={industry} onChange={(v) => setField('industry', v)} />
          </Wizard>
          <Wizard step={2} title="Welcher Stil?">
            <MultiGroup options={STYLES} values={styles} onToggle={(v) => toggle('styles', v)} />
          </Wizard>
          <Wizard step={3} title="Was soll die Webseite erreichen?">
            <MultiGroup options={GOALS} values={goals} onToggle={(v) => toggle('goals', v)} />
          </Wizard>
          <Wizard step={4} title="Welche Funktionen sind wichtig?">
            <MultiGroup options={FEATURES} values={features} onToggle={(v) => toggle('features', v)} />
          </Wizard>
          <Wizard step={5} title="Region?">
            <SingleGroup options={REGIONS} value={region} onChange={(v) => setField('region', v)} />
          </Wizard>

          <div className="card flex flex-wrap items-center gap-4 p-5">
            <label className="text-sm">
              Ergebnisse:&nbsp;
              <select value={maxResults} onChange={(e) => setField('maxResults', Number(e.target.value))} className="inp inline-block w-24 align-middle">
                {[5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button onClick={() => start()} disabled={running} className="btn-ink ml-auto inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-medium">
              <Play size={16} /> {running ? 'Suche läuft …' : 'Suche starten'}
            </button>
          </div>
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">Aktive Filter:</span>
          {activeChips.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs text-[var(--color-paper)]">
              {c.label}
              <button onClick={c.clear}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <div className="card p-5">
        <ManualUrls urls={manualUrls} onChange={(u) => setField('manualUrls', u)} />
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
          <input type="checkbox" checked={manualSearchOnly} onChange={(e) => setField('manualSearchOnly', e.target.checked)} />
          Nur manuelle URLs analysieren (keine automatische Suche)
        </label>
      </div>

      {error && <div className="card border-red-300/60 bg-red-50/60 p-4 text-sm text-red-700">{error}</div>}
      {progress && <ProgressPanel progress={progress} phases={PHASES} extra={project ? undefined : `${results.length} Webseiten bewertet`} />}

      {noResults && (
        <div className="card border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/30 p-4 text-sm text-[var(--color-ink-soft)]">
          Keine automatischen Treffer (Quellen evtl. blockiert). Öffne unten eine Suchanfrage, kopiere Webseiten und füge sie oben als manuelle URL ein – oder hinterlege einen Such-API-Key in den Einstellungen.
        </div>
      )}
      {queries.length > 0 && (results.length === 0 || noResults) && <QueriesPanel queries={queries} />}

      {/* Erkannte Branche + Suchmodus */}
      {project && (project.targetFamilyLabel || project.detected.industry) && (
        <div className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium"><Building2 size={15} className="text-[var(--color-gold)]" /> Erkannt: {project.targetFamilyLabel || project.detected.industry}</span>
          {project.detected.styles.length > 0 && <span className="text-[var(--color-muted)]">Stil: {project.detected.styles.join(', ')}</span>}
          <span className="text-[var(--color-muted)]">Suche: weltweit beste {project.targetFamilyLabel || 'Branchen'}-Webseiten</span>
          <span className="text-[var(--color-muted)]">Quellen: {project.providersUsed.length ? project.providersUsed.join(', ') : 'manuell'}</span>
        </div>
      )}

      {/* Warnungen (wenige passende Treffer / ausgeblendete Branchen) */}
      {project?.searchWarnings?.map((w, i) => (
        <div key={i} className="card border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/30 p-3 text-sm text-[var(--color-ink-soft)]">⚠️ {w}</div>
      ))}

      {results.length > 0 && (
        <ResultsBlock
          results={results}
          report={project?.report}
          projectId={project?.id}
          learnLabel="Was LL Studio lernen kann"
          liveMode={!project}
          onReset={reset}
          header={
            project && (
              <div className="text-sm text-[var(--color-muted)]">
                Nur passende Branche · {project.aiUsed ? 'KI-Report' : 'regelbasiert'}
              </div>
            )
          }
        />
      )}

      {/* Ausgeblendete Treffer (Debug) */}
      {project?.rejected && project.rejected.length > 0 && (
        <div className="card p-4">
          <button onClick={() => setShowRejected((v) => !v)} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            <EyeOff size={14} /> {project.rejected.length} ausgeblendete Treffer (falsche Branche/Plattform) {showRejected ? 'ausblenden' : 'anzeigen'}
          </button>
          {showRejected && (
            <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">
              {project.rejected.map((r, i) => (
                <li key={i}>
                  <span className="text-[var(--color-ink-soft)]">{r.domain}</span> — {r.reason}{r.industry ? ` (erkannt: ${r.industry})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!hasInput && !progress && !project && (
        <div className="rounded-xl border border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          ⚠️ Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren.
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={cls('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition', active ? 'btn-ink' : 'btn-ghost')}>
      {icon} {label}
    </button>
  )
}

function Wizard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-ink)] text-xs font-semibold text-[var(--color-paper)]">{step}</span>
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function SingleGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(value === o ? '' : o)} className={cls('chip rounded-full px-3.5 py-1.5 text-sm', value === o && 'chip-active')}>
          {o}
        </button>
      ))}
    </div>
  )
}

function MultiGroup({ options, values, onToggle }: { options: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} onClick={() => onToggle(o)} className={cls('chip rounded-full px-3.5 py-1.5 text-sm', values.includes(o) && 'chip-active')}>
          {o}
        </button>
      ))}
    </div>
  )
}
