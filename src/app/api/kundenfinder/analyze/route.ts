import { getCompany, saveWebsiteAnalysis, setLeadScore, qualifyCompany } from '@/server/services/kundenfinder/companiesRepo'
import { analyzeWebsite } from '@/server/services/kundenfinder/websiteAnalyzer'
import { computeLeadScore } from '@/server/services/kundenfinder/leadScore'
import { BrowserManager } from '@/server/services/browser'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Website eines Unternehmens (erneut) prüfen + Scores aktualisieren. */
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id: string }
    const c = getCompany(id)
    if (!c) return Response.json({ ok: false, error: 'Unternehmen nicht gefunden.' }, { status: 404 })
    const bm = new BrowserManager(true)
    try {
      const wa = await analyzeWebsite(bm, c.website)
      saveWebsiteAnalysis(id, wa)
      const ls = computeLeadScore({ website: c.website, phone: c.phone, email: c.email, contactName: c.contactName, industry: c.industry }, wa)
      setLeadScore(id, ls.score, ls.label, ls.reasons)
      const company = qualifyCompany(id) // Priorität + Notiz aus neuer Analyse (manuell bearbeitete Notiz bleibt)
      return Response.json({ ok: true, analysis: wa, leadScore: ls, company })
    } finally {
      await bm.close()
    }
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
