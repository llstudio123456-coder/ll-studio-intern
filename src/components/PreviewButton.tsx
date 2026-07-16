'use client'
import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'
import type { CompetitorAnalysis } from '@shared/types'
import { usePreviewStore } from '@/lib/stores/previewStore'
import { useToast } from '@/lib/stores/toastStore'

/** Übernimmt eine Inspirations-Website (B) als Stilvorlage und öffnet die Design-Vorschau. */
export function PreviewButton({
  competitor,
  label = 'Vorschau mit diesem Stil',
  variant = 'ghost'
}: {
  competitor: CompetitorAnalysis
  label?: string
  variant?: 'ghost' | 'ink' | 'gold'
}) {
  const router = useRouter()
  const setInspiration = usePreviewStore((s) => s.setInspirationFromCompetitor)
  const toast = useToast((s) => s.show)

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setInspiration(competitor)
    if (competitor.score.breakdown.designQuality < 75)
      toast('Hinweis: optisch nicht stark genug – eher für Inhalte/Struktur geeignet.', 'info')
    router.push('/design-preview')
  }

  const cls = variant === 'ink' ? 'btn-ink' : variant === 'gold' ? 'bg-[var(--color-gold)] text-white hover:opacity-90' : 'btn-ghost'
  return (
    <button onClick={onClick} className={`${cls} inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium`}>
      <Eye size={15} /> {label}
    </button>
  )
}
