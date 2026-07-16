'use client'
import { MapPin, Building2, Users, Palette, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import type { TargetWebsiteAnalysis } from '@shared/types'
import { Badge, ColorSwatches } from './ui/Bits'
import { PromptButton } from './PromptButton'
import { shotUrl } from '@/lib/format'

const FEATURE_LABELS: Record<string, string> = {
  contactForm: 'Kontaktformular', onlineBooking: 'Terminbuchung', whatsapp: 'WhatsApp', phoneClickToCall: 'Klick-Anruf',
  reviews: 'Bewertungen', beforeAfter: 'Vorher/Nachher', faq: 'FAQ', career: 'Karriere', gallery: 'Galerie'
}

export function TargetSummary({ t }: { t: TargetWebsiteAnalysis }) {
  const shot = shotUrl(t.screenshotDesktop)
  const activeFeatures = Object.entries(t.features).filter(([k, v]) => v && FEATURE_LABELS[k])

  return (
    <div className="card overflow-hidden fade-up">
      <div className="grid gap-0 md:grid-cols-[260px_1fr]">
        <div className="bg-[var(--color-paper-2)]">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Screenshot" className="h-full max-h-[230px] w-full object-cover object-top" />
          ) : (
            <div className="grid h-full min-h-[180px] place-items-center text-xs text-[var(--color-muted)]">Kein Screenshot</div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-wide text-[var(--color-muted)] uppercase">Kunden-Webseite</div>
              <h2 className="font-display text-2xl">{t.companyName || t.domain}</h2>
              <a href={t.finalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:underline">
                {t.domain} <ExternalLink size={13} />
              </a>
            </div>
            <div className="flex flex-col items-end gap-2">
              {!t.reachable && <Badge tone="soft">nicht erreichbar</Badge>}
              <PromptButton target={t} variant="gold" label="Als Stilvorlage nutzen" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info icon={<Building2 size={15} />} label="Branche" value={`${t.industry || 'unklar'}${t.industryConfidence ? ` (${Math.round(t.industryConfidence * 100)}%)` : ''}`} />
            <Info icon={<MapPin size={15} />} label="Standort" value={t.resolvedLocation || t.location || 'unklar'} />
            <Info icon={<Users size={15} />} label="Zielgruppe" value={t.targetAudience || '—'} />
            <Info icon={<Palette size={15} />} label="Stil / Tonalität" value={`${t.designStyle} · ${t.tonality}`} />
          </div>

          {t.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.services.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-[var(--color-muted)]">Farben:</span>
            <ColorSwatches colors={t.colors} />
          </div>

          {activeFeatures.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeFeatures.map(([k]) => (
                <Badge key={k} tone="gold">
                  {FEATURE_LABELS[k]}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {(t.weaknesses.length > 0 || t.strengths.length > 0) && (
        <div className="grid gap-4 border-t border-[var(--color-line)] p-5 md:grid-cols-2">
          {t.strengths.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <CheckCircle2 size={15} className="text-green-600" /> Stärken
              </div>
              <ul className="space-y-1 text-sm text-[var(--color-ink-soft)]">
                {t.strengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {t.weaknesses.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <AlertTriangle size={15} className="text-amber-600" /> Schwächen
              </div>
              <ul className="space-y-1 text-sm text-[var(--color-ink-soft)]">
                {t.weaknesses.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[var(--color-gold)]">{icon}</span>
      <div>
        <div className="text-[11px] tracking-wide text-[var(--color-muted)] uppercase">{label}</div>
        <div className="text-sm text-[var(--color-ink)]">{value}</div>
      </div>
    </div>
  )
}
