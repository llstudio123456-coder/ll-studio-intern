'use client'
import { X, ExternalLink, Lightbulb, Star, ShieldAlert } from 'lucide-react'
import type { CompetitorAnalysis } from '@shared/types'
import { ScoreRing } from './ui/ScoreRing'
import { Badge, ColorSwatches, DisclaimerBar, Section } from './ui/Bits'
import { PromptButton } from './PromptButton'
import { PreviewButton } from './PreviewButton'
import { shotUrl } from '@/lib/format'

const SCORE_LABELS: Record<string, string> = {
  designQuality: 'Design-Qualität', modernity: 'Modernität', mobile: 'Mobile', structure: 'Struktur',
  callToActions: 'Call-to-Actions', imagery: 'Bildqualität', styleFit: 'Stil-Fit', trustSignals: 'Vertrauen',
  performance: 'Performance', inspirationValue: 'Inspiration'
}
const FEATURE_LABELS: Record<string, string> = {
  contactForm: 'Kontaktformular', onlineBooking: 'Online-Terminbuchung', whatsapp: 'WhatsApp', phoneClickToCall: 'Klick-zum-Anrufen',
  reviews: 'Bewertungen', beforeAfter: 'Vorher/Nachher', faq: 'FAQ', career: 'Karriere', gallery: 'Galerie',
  newsletter: 'Newsletter', liveChat: 'Live-Chat', multiLanguage: 'Mehrsprachig'
}

export function ResultDetail({ c, onClose }: { c: CompetitorAnalysis; onClose: () => void }) {
  const desktop = shotUrl(c.snapshot.screenshotDesktop)
  const mobile = shotUrl(c.snapshot.screenshotMobile)
  const features = Object.entries(c.snapshot.features).filter(([k, v]) => v && FEATURE_LABELS[k])

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card my-4 h-fit w-full max-w-4xl overflow-hidden fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] p-5">
          <div className="flex items-center gap-4">
            <ScoreRing score={c.score.total} size={62} />
            <div>
              <h2 className="font-display text-2xl">{c.snapshot.companyName || c.snapshot.domain}</h2>
              <a href={c.snapshot.finalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:underline">
                {c.snapshot.finalUrl} <ExternalLink size={13} />
              </a>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone="ink">{c.snapshot.industry || 'Branche unklar'}</Badge>
                <Badge>{c.snapshot.designStyle}</Badge>
                {c.snapshot.location && <Badge tone="soft">{c.snapshot.location}</Badge>}
                {c.queryRelevance != null && <Badge tone="gold">Relevanz {c.queryRelevance}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PreviewButton competitor={c} variant="gold" label="Stil auf Kundenprojekt anwenden" />
            <PromptButton competitor={c} label="Prompt erstellen" />
            <button onClick={onClose} className="btn-ghost grid h-9 w-9 place-items-center rounded-full">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid max-h-[70vh] gap-6 overflow-y-auto p-5 lg:grid-cols-2">
          <div className="space-y-3">
            {desktop && (
              <div>
                <div className="mb-1 text-xs text-[var(--color-muted)]">Desktop</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={desktop} alt="Desktop" className="w-full rounded-xl border border-[var(--color-line)]" />
              </div>
            )}
            {mobile && (
              <div>
                <div className="mb-1 text-xs text-[var(--color-muted)]">Mobil</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mobile} alt="Mobil" className="w-44 rounded-xl border border-[var(--color-line)]" />
              </div>
            )}
          </div>

          <div className="space-y-5">
            <p className="text-sm text-[var(--color-ink-soft)]">{c.shortDescription}</p>
            <Section title={c.whyMatches ? 'Warum passend zur Suche' : 'Warum als Inspiration geeignet'}>
              <p className="text-sm text-[var(--color-ink-soft)]">{c.whyMatches || c.whyInspiring}</p>
            </Section>
            <Section title="Hauptfarben">
              <ColorSwatches colors={c.snapshot.colors} />
            </Section>
            <Section title="Starke Elemente">
              <ul className="space-y-1 text-sm text-[var(--color-ink-soft)]">
                {c.strongElements.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <Star size={14} className="mt-0.5 shrink-0 text-[var(--color-gold)]" /> {s}
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Ideen für LL Studio">
              <ul className="space-y-1 text-sm text-[var(--color-ink-soft)]">
                {c.ideasToAdopt.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-[var(--color-gold)]" /> {s}
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <div>
            <Section title="Bewertung im Detail">
              <div className="space-y-1.5">
                {Object.entries(c.score.breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-[var(--color-muted)]">{SCORE_LABELS[k]}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-paper-2)]">
                      <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${v}%` }} />
                    </div>
                    <span className="w-7 text-right text-xs tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div className="space-y-5">
            <Section title={`Erkannte Unterseiten (${c.snapshot.pages.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {c.snapshot.pages.length ? c.snapshot.pages.map((p, i) => <Badge key={i}>{p.label}</Badge>) : <span className="text-xs text-[var(--color-muted)]">keine erkannt</span>}
              </div>
            </Section>
            <Section title="Besondere Funktionen">
              <div className="flex flex-wrap gap-1.5">
                {features.length ? features.map(([k]) => <Badge key={k} tone="gold">{FEATURE_LABELS[k]}</Badge>) : <span className="text-xs text-[var(--color-muted)]">keine erkannt</span>}
              </div>
            </Section>
          </div>

          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]">
              <ShieldAlert size={15} className="text-amber-600" /> Was NICHT kopieren
            </div>
            <DisclaimerBar text={c.doNotCopyWarning} />
          </div>
        </div>
      </div>
    </div>
  )
}
