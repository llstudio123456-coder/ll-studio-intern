import { getCompany } from '@/server/services/kundenfinder/companiesRepo'
import { researchPeople } from '@/server/services/kundenfinder/personResearch'
import { persistResearch, listPeople, buildPeopleSummary } from '@/server/services/kundenfinder/peopleRepo'
import { BrowserManager } from '@/server/services/browser'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

/**
 * Personen-/Entscheider-Recherche für ein Unternehmen (nur eigene, geschäftlich veröffentlichte
 * Quellen: Impressum/Team/Über-uns/Kontakt). Manuell bestätigte Daten werden nicht überschrieben.
 */
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id: string }
    const c = getCompany(id)
    if (!c) return Response.json({ ok: false, error: 'Unternehmen nicht gefunden.' }, { status: 404 })
    const bm = new BrowserManager(true)
    try {
      const res = await researchPeople(bm, c.website)
      const persisted = persistResearch(id, res)
      const company = getCompany(id)!
      const people = listPeople(id)
      return Response.json({
        ok: true,
        company,
        people,
        summary: buildPeopleSummary(company, people),
        run: { pagesChecked: res.pagesChecked, log: res.log, peopleFound: persisted.people, contactsFound: persisted.contacts }
      })
    } finally {
      await bm.close()
    }
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
