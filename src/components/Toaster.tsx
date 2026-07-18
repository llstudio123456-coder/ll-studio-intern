'use client'
import { Check, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '@/lib/stores/toastStore'

/** Globale Toast-Anzeige (unten rechts). In das Root-Layout eingebunden. */
export function Toaster() {
  const { toasts, dismiss } = useToast()
  return (
    // Bottom-Nav auf dem Smartphone nicht verdecken: Abstand nach unten per Safe-Area + Leiste.
    <div className="pointer-events-none fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] flex flex-col gap-2 lg:bottom-4">
      {toasts.map((t) => {
        const icon = t.type === 'error' ? <AlertTriangle size={16} /> : t.type === 'info' ? <Info size={16} /> : <Check size={16} />
        const accent =
          t.type === 'error' ? 'text-red-600' : t.type === 'info' ? 'text-[var(--color-ink-soft)]' : 'text-green-600'
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm shadow-[0_10px_30px_rgb(0,0,0,0.12)] fade-up"
          >
            <span className={accent}>{icon}</span>
            <span className="text-[var(--color-ink)]">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-gold)] hover:bg-[var(--color-hover)]"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="Schließen" className="ml-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
