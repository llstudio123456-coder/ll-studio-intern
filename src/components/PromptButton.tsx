'use client'
import { useRouter } from 'next/navigation'
import { Wand2 } from 'lucide-react'
import type { CompetitorAnalysis, TargetWebsiteAnalysis } from '@shared/types'
import { usePromptStore } from '@/lib/stores/promptStore'
import { refFromCompetitor, refFromTarget } from '@/lib/promptRef'

/** Button, der eine Website als Stilvorlage übernimmt und zum Prompt-Generator wechselt. */
export function PromptButton({
  competitor,
  target,
  label = 'Prompt erstellen',
  variant = 'ghost'
}: {
  competitor?: CompetitorAnalysis
  target?: TargetWebsiteAnalysis
  label?: string
  variant?: 'ghost' | 'ink' | 'gold'
}) {
  const router = useRouter()
  const setInspiration = usePromptStore((s) => s.setInspiration)

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (competitor) setInspiration(refFromCompetitor(competitor))
    else if (target) setInspiration(refFromTarget(target))
    else return
    router.push('/prompt-generator')
  }

  const cls =
    variant === 'ink'
      ? 'btn-ink'
      : variant === 'gold'
        ? 'bg-[var(--color-gold)] text-white hover:opacity-90'
        : 'btn-ghost'

  return (
    <button onClick={onClick} className={`${cls} inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium`}>
      <Wand2 size={15} /> {label}
    </button>
  )
}
