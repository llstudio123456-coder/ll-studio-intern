'use client'
import { Phone, Copy, AlertTriangle } from 'lucide-react'
import { telHref } from '@shared/phone'
import { useToast } from '@/lib/stores/toastStore'

/**
 * Anklickbare Telefonnummer.
 *
 * - Gültige Nummer → echter `tel:`-Link (öffnet auf dem Smartphone direkt die Anruffunktion),
 *   plus ein Kopieren-Knopf für den Desktop.
 * - Ungültige Nummer → kein kaputter Link, sondern Hinweis „Prüfung erforderlich".
 * - `stopPropagation`: Ein Klick auf die Nummer öffnet NICHT die darüberliegende Kundenkarte
 *   (Spezifikation §8/§22 — sauberes Event-Handling).
 */
export function PhoneLink({ phone, className = '', showCopy = true }: { phone?: string | null; className?: string; showCopy?: boolean }) {
  const toast = useToast((t) => t.show)
  if (!phone) return null

  const href = telHref(phone)
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    navigator.clipboard.writeText(phone).then(() => toast('Telefonnummer wurde kopiert.', 'success')).catch(() => {})
  }

  if (!href) {
    return (
      <span className={`inline-flex items-center gap-1 text-amber-700 ${className}`} title="Diese Nummer konnte nicht als Anruf-Link erkannt werden.">
        <AlertTriangle size={12} className="shrink-0" />
        <span className="truncate">{phone}</span>
        <span className="text-[10px]">· Prüfung erforderlich</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <a
        href={href}
        onClick={(e) => e.stopPropagation()}
        title={`${phone} anrufen`}
        className="inline-flex min-h-[32px] items-center gap-1 text-[var(--color-ink-soft)] hover:text-[var(--color-gold)]"
      >
        <Phone size={12} className="shrink-0" />
        <span className="truncate">{phone}</span>
      </a>
      {showCopy && (
        <button onClick={copy} aria-label="Telefonnummer kopieren" title="Telefonnummer kopieren" className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          <Copy size={11} />
        </button>
      )}
    </span>
  )
}

/**
 * Prominenter „Anrufen"-Knopf für mobile Kundenkarten (Spezifikation §18).
 * Große Touch-Fläche, klarer `tel:`-Link. Erscheint nur bei gültiger Nummer.
 */
export function CallButton({ phone, className = '' }: { phone?: string | null; className?: string }) {
  const href = telHref(phone)
  if (!href) return null
  return (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 text-sm font-medium text-white active:bg-green-700 ${className}`}
    >
      <Phone size={15} /> Anrufen
    </a>
  )
}
