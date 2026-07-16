import { Compass, LayoutList, Home, MousePointerClick, Palette, Wrench, Trophy, ShieldCheck, GraduationCap } from 'lucide-react'
import type { InspirationReport } from '@shared/types'
import { DisclaimerBar } from './ui/Bits'

export function InspirationSummary({ r, learnLabel = 'Was LL Studio lernen kann' }: { r: InspirationReport; learnLabel?: string }) {
  return (
    <div className="card p-6 fade-up">
      <div className="mb-1 flex items-center gap-2">
        <Compass size={18} className="text-[var(--color-gold)]" />
        <h2 className="font-display text-2xl">Inspirations-Auswertung</h2>
        <span className="ml-2 rounded-full bg-[var(--color-paper-2)] px-2.5 py-0.5 text-xs text-[var(--color-muted)]">
          {r.aiUsed ? 'KI-gestützt' : 'regelbasiert'}
        </span>
      </div>
      <p className="mb-5 text-sm text-[var(--color-ink-soft)]">{r.recommendedDesignDirection}</p>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Block icon={<LayoutList size={15} />} title="Notwendige Seiten" items={r.mustHavePages} />
        <Block icon={<Home size={15} />} title="Startseiten-Inhalte" items={r.homepageContent} />
        <Block icon={<MousePointerClick size={15} />} title="Passende CTAs" items={r.recommendedCtas} />
        <Block icon={<Palette size={15} />} title="Farben & Layout" items={r.colorAndLayoutIdeas} />
        <Block icon={<Wrench size={15} />} title="Sinnvolle Funktionen" items={r.recommendedFeatures} />
        <Block icon={<GraduationCap size={15} />} title={learnLabel} items={r.targetMistakesVsCompetitors} tone="warn" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <RefBlock icon={<Trophy size={15} />} title="Beste Design-Vorbilder" refs={r.bestDesignReferences} />
        <RefBlock icon={<ShieldCheck size={15} />} title="Beste für Inhalt / Vertrauen" refs={r.bestForContentOrTrust} />
      </div>

      <div className="mt-5">
        <DisclaimerBar text={r.disclaimer} />
      </div>
    </div>
  )
}

function Block({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone?: 'warn' }) {
  return (
    <div className={'rounded-xl border border-[var(--color-line)] p-4 ' + (tone === 'warn' ? 'bg-[var(--color-gold-soft)]/30' : '')}>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <span className="text-[var(--color-gold)]">{icon}</span> {title}
      </div>
      <ul className="space-y-1 text-sm text-[var(--color-ink-soft)]">
        {items.length ? items.map((it, i) => <li key={i}>• {it}</li>) : <li className="text-[var(--color-muted)]">—</li>}
      </ul>
    </div>
  )
}

function RefBlock({ icon, title, refs }: { icon: React.ReactNode; title: string; refs: { id: string; domain: string; reason: string }[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <span className="text-[var(--color-gold)]">{icon}</span> {title}
      </div>
      <ul className="space-y-1.5 text-sm">
        {refs.length ? (
          refs.map((rf) => (
            <li key={rf.id}>
              <span className="font-medium">{rf.domain}</span>
              <span className="text-[var(--color-muted)]"> — {rf.reason}</span>
            </li>
          ))
        ) : (
          <li className="text-[var(--color-muted)]">—</li>
        )}
      </ul>
    </div>
  )
}
