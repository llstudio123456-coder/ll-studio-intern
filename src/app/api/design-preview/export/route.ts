import type { GeneratedHomepageConcept } from '@shared/types'
import { renderPreviewHtml } from '@/server/services/previewHtmlService'
import { BrowserManager } from '@/server/services/browser'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const { concept, format } = (await req.json()) as { concept: GeneratedHomepageConcept; format: 'html' | 'png' }
  const html = renderPreviewHtml(concept)
  const base = (concept.companyName || 'vorschau').replace(/[^a-z0-9]/gi, '_')

  if (format === 'html') {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}_vorschau.html"` }
    })
  }

  // PNG via Playwright
  const bm = new BrowserManager(true)
  try {
    const page = await bm.newPage()
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.setContent(html, { waitUntil: 'networkidle' })
    const png = await page.screenshot({ fullPage: true, type: 'png' })
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${base}_vorschau.png"` }
    })
  } finally {
    await bm.close()
  }
}
