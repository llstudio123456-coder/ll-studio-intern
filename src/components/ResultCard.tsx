'use client'
import { ExternalLink, MapPin } from 'lucide-react'
import type { CompetitorAnalysis } from '@shared/types'
import { ScoreRing } from './ui/ScoreRing'
import { Badge, ColorSwatches } from './ui/Bits'
import { PromptButton } from './PromptButton'
import { PreviewButton } from './PreviewButton'
import { shotUrl, scoreLabel } from '@/lib/format'

const FEATURE_LABELS: Record<string, string> = {
  onlineBooking: 'Terminbuchung',
  reviews: 'Bewertungen',
  gallery: 'Galerie',
  beforeAfter: 'Vorher/Nachher',
  contactForm: 'Formular',
  whatsapp: 'WhatsApp',
  faq: 'FAQ'
}

export function ResultCard({ c, rank, onOpen }: { c: CompetitorAnalysis; rank: number; onOpen: () => void }) {
  const shot = shotUrl(c.snapshot.screenshotDesktop)
  const features = Object.entries(c.snapshot.features).filter(([k, v]) => v && FEATURE_LABELS[k]).slice(0, 4)

  return (
    <div className="card group overflow-hidden fade-up transition-shadow hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <button onClick={onOpen} className="relative block w-full text-left">
        <div className="aspect-[16/10] overflow-hidden bg-[var(--color-paper-2)]">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt={c.snapshot.domain} className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-[var(--color-muted)]">Kein Screenshot</div>
          )}
        </div>
        <span className="absolute top-3 left-3 rounded-lg bg-[var(--color-ink)] px-2 py-0.5 text-xs font-semibold text-[var(--color-paper)]">#{rank}</span>
        <span className="absolute top-3 right-3 rounded-lg bg-[var(--color-surface)]/90 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
          {scoreLabel(c.score.total)}
        </span>
        {c.queryRelevance != null && (
          <span className="absolute bottom-3 left-3 rounded-lg bg-[var(--color-gold)]/90 px-2 py-0.5 text-[11px] font-medium text-white">
            Relevanz {c.queryRelevance}
          </span>
        )}
      </button>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg">{c.snapshot.companyName || c.snapshot.domain}</h3>
            <a href={c.snapshot.finalUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--color-gold)] hover:underline">
              <span className="truncate">{c.snapshot.domain}</span> <ExternalLink size={11} className="shrink-0" />
            </a>
          </div>
          <ScoreRing score={c.score.total} size={50} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <Badge>{c.snapshot.designStyle}</Badge>
          {c.snapshot.industry && <Badge tone="soft">{c.snapshot.industry}</Badge>}
          {c.snapshot.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} /> {c.snapshot.location}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-soft)]">{c.whyMatches || c.whyInspiring}</p>

        <div className="mt-3 flex items-center justify-between">
          <ColorSwatches colors={c.snapshot.colors} />
          <div className="flex flex-wrap justify-end gap-1">
            {features.map(([k]) => (
              <Badge key={k} tone="soft">
                {FEATURE_LABELS[k]}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <button onClick={onOpen} className="btn-ghost w-full rounded-lg py-2 text-sm font-medium">
            Details ansehen
          </button>
          <div className="grid grid-cols-2 gap-2">
            <PromptButton competitor={c} variant="gold" label="Prompt" />
            <PreviewButton competitor={c} label="Vorschau" />
          </div>
        </div>
      </div>
    </div>
  )
}
