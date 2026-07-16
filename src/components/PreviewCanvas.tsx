'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeneratedHomepageConcept } from '@shared/types'
import { renderPreviewHtml } from '@/server/services/previewHtmlService'

function ScaledFrame({ html, natW, natH, sandbox }: { html: string; natW: number; natH: number; sandbox: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(natW)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = w / natW
  return (
    <div ref={ref} style={{ width: '100%', height: natH * scale, overflow: 'hidden' }}>
      <iframe
        srcDoc={html}
        title="Design-Vorschau"
        sandbox={sandbox}
        style={{ width: natW, height: natH, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

/**
 * Editierbares iframe: HTML wird beim Mount EINMAL eingefroren (kein Reload beim Tippen).
 * Änderungen werden per postMessage nach außen gemeldet. Remount über key (z. B. Gerät).
 */
function EditableFrame({
  initialHtml,
  natW,
  natH,
  onEdit
}: {
  initialHtml: string
  natW: number
  natH: number
  onEdit: (path: string, value: string) => void
}) {
  const [html] = useState(initialHtml) // eingefroren
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data as { __llEdit?: boolean; path?: string; value?: string }
      if (d && d.__llEdit && d.path != null) onEdit(d.path, d.value ?? '')
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onEdit])
  return <ScaledFrame html={html} natW={natW} natH={natH} sandbox="allow-scripts allow-same-origin" />
}

/** Rendert die Konzept-Startseite als skalierte, isolierte Vorschau (Desktop/Mobil, optional editierbar). */
export function PreviewCanvas({
  concept,
  device = 'desktop',
  editable = false,
  onEdit
}: {
  concept: GeneratedHomepageConcept
  device?: 'desktop' | 'mobile'
  editable?: boolean
  onEdit?: (path: string, value: string) => void
}) {
  const html = useMemo(() => renderPreviewHtml(concept, editable), [concept, editable])
  const natW = device === 'mobile' ? 412 : 1280
  const natH = device === 'mobile' ? 2600 : 2200

  const frame =
    editable && onEdit ? (
      // key=device → bei Geräte-/Editierwechsel neu mit aktuellem Stand mounten
      <EditableFrame key={device} initialHtml={html} natW={natW} natH={natH} onEdit={onEdit} />
    ) : (
      <ScaledFrame html={html} natW={natW} natH={natH} sandbox="allow-same-origin" />
    )

  if (device === 'mobile') {
    return (
      <div className="mx-auto" style={{ maxWidth: 400 }}>
        <div className="overflow-hidden rounded-[2rem] border-[10px] border-[var(--color-ink)] shadow-xl">{frame}</div>
      </div>
    )
  }
  return <div className="overflow-hidden rounded-xl border border-[var(--color-line)] shadow-sm">{frame}</div>
}
