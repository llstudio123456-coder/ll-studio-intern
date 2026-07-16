'use client'
import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Bestätigungsdialog für sensible Aktionen. Bewusst modal und ohne Vorauswahl des
 * Bestätigen-Knopfes, damit niemand eine Deaktivierung „durchklickt".
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div className="card w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {danger && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />}
          <div className="min-w-0">
            <h2 id="confirm-title" className="font-display text-xl text-[var(--color-ink)]">{title}</h2>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{body}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} onClick={onCancel} className="btn-ghost rounded-lg px-4 py-2 text-sm">Abbrechen</button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'btn-ink'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
