import type { AIPreviewRequest } from '@shared/types'
import { BrowserManager } from '@/server/services/browser'
import { cloneReferenceWithCustomerAssets } from '@/server/services/htmlCloneService'
import { normalizeUrl } from '@/server/utils/url'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

/**
 * 1:1-Klon: lädt die Referenz-B-Seite, baut ein eigenständiges, sandboxed HTML und
 * ersetzt Logo/Farben/Bilder/Name durch die von Kunde A.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AIPreviewRequest
    const refUrl = body?.inspiration?.url ? normalizeUrl(body.inspiration.url) : ''
    if (!refUrl) return Response.json({ ok: false, error: 'Referenz-B-URL fehlt (für den Klon nötig).' }, { status: 400 })
    if (!body?.result?.concept?.palette) return Response.json({ ok: false, error: 'Analyse-Daten (result) fehlen.' }, { status: 400 })

    // Guard: nur ECHTE externe Websites klonen – niemals die eigene App/localhost/interne IPs
    let host = ''
    try {
      host = new URL(refUrl).hostname.toLowerCase()
    } catch {
      return Response.json({ ok: false, error: `Referenz-B-URL ungültig: ${refUrl}` }, { status: 400 })
    }
    const reqHost = (() => {
      try {
        return new URL(req.url).hostname.toLowerCase()
      } catch {
        return ''
      }
    })()
    const isInternal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === reqHost ||
      host.endsWith('.local') ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    if (isInternal)
      return Response.json(
        { ok: false, error: `Referenz B ist keine externe Website (${host}). Bitte bei „Referenz B“ eine echte externe URL angeben, z. B. https://www.cafe-feynsinn.de/.` },
        { status: 400 }
      )

    const bm = new BrowserManager(true)
    try {
      const { html, report } = await cloneReferenceWithCustomerAssets(bm, refUrl, body.source, body.inspiration, body.result)
      if (!report.ok) return Response.json({ ok: false, error: report.notes.join('; ') || 'Klon fehlgeschlagen.', report }, { status: 502 })
      return Response.json({ ok: true, html, report })
    } finally {
      await bm.close()
    }
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
