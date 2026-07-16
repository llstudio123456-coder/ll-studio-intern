import { BrowserManager } from '@/server/services/browser'
import { auditCustomerColors } from '@/server/services/customerColorAuditService'
import { normalizeUrl } from '@/server/utils/url'

export const runtime = 'nodejs'
export const maxDuration = 180
export const dynamic = 'force-dynamic'

/** Vollständige Farbanalyse (Audit) einer Kunden-Website. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('url') || ''
  const url = normalizeUrl(raw)
  if (!url) return Response.json({ ok: false, error: 'Ungültige URL' }, { status: 400 })
  const bm = new BrowserManager(true)
  try {
    const audit = await auditCustomerColors(bm, url)
    return Response.json({ ok: true, audit })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  } finally {
    await bm.close()
  }
}
