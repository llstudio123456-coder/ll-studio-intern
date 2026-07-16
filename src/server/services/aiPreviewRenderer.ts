import type { GeneratedPreviewCode, PreviewCodeFormat } from '@shared/types'

/**
 * Säubert KI-generiertes HTML für die sichere iframe-Vorschau:
 * entfernt <script>, Event-Handler (on*), externe <iframe>/<object>/<embed>,
 * fremde <link rel=stylesheet>-Tracker und javascript:-URLs.
 * Das iframe wird zusätzlich mit sandbox ohne allow-scripts gerendert (Client-Seite).
 */
export function sanitizePreviewHtml(html: string): string {
  let out = html || ''
  // <script>…</script> komplett entfernen
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<!-- script entfernt -->')
  out = out.replace(/<script\b[^>]*\/?>/gi, '')
  // <iframe>/<object>/<embed>/<applet> entfernen
  out = out.replace(/<(iframe|object|embed|applet)\b[^>]*>[\s\S]*?<\/\1>/gi, '<!-- eingebettetes Objekt entfernt -->')
  out = out.replace(/<(iframe|object|embed|applet)\b[^>]*\/?>/gi, '')
  // Inline-Event-Handler on...="..." / on...='...' entfernen
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
  // javascript:-URLs neutralisieren
  out = out.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
  // <link rel=stylesheet>/<link rel=preload> auf fremde Domains: Fonts (googleapis/gstatic) erlauben, Rest entfernen
  out = out.replace(/<link\b[^>]*>/gi, (m) => (/fonts\.(googleapis|gstatic)\.com/i.test(m) ? m : ''))
  // <meta http-equiv="refresh"> entfernen
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*("|')refresh\1[^>]*>/gi, '')
  return out
}

/** Baut aus generiertem Code das renderbare (sichere) HTML für die Vorschau, falls möglich. */
export function toRenderableHtml(code: string, format: PreviewCodeFormat): string | undefined {
  if (format !== 'html') return undefined // React/Next/Prompt: kein direktes iframe-Rendering
  const safe = sanitizePreviewHtml(code)
  // sicherstellen, dass ein Grundgerüst vorhanden ist
  if (/<html[\s>]/i.test(safe)) return safe
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${safe}</body></html>`
}

export function buildGeneratedCode(code: string, language: 'html' | 'jsx' | 'tsx' | 'text', format: PreviewCodeFormat): GeneratedPreviewCode {
  return { format, code, language, renderableHtml: toRenderableHtml(code, format) }
}

/** Erkennt (vor dem Sanitizen) potenziell gefährliche/unerwünschte Konstrukte im Code. */
export function detectSecurityIssues(code: string): string[] {
  const issues: string[] = []
  if (/<script\b/i.test(code)) issues.push('<script>-Tag gefunden')
  if (/\son[a-z]+\s*=/i.test(code)) issues.push('Inline-Event-Handler (on…=) gefunden')
  if (/javascript:/i.test(code)) issues.push('javascript:-URL gefunden')
  if (/<iframe\b/i.test(code)) issues.push('<iframe> gefunden')
  if (/<(object|embed|applet)\b/i.test(code)) issues.push('eingebettetes Objekt (object/embed) gefunden')
  if (/<meta\b[^>]*http-equiv\s*=\s*("|')?refresh/i.test(code)) issues.push('meta-refresh gefunden')
  if (/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket/i.test(code)) issues.push('Netzwerkaufruf (fetch/XHR/WebSocket) gefunden')
  return issues
}
