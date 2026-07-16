import { getCompany } from '@/server/services/kundenfinder/companiesRepo'
import { extractPeopleFromPage, type PageKind } from '@/server/services/kundenfinder/personExtract'
import { persistResearch, listPeople, buildPeopleSummary } from '@/server/services/kundenfinder/peopleRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Manuelle Personen-Recherche: extrahiert Personen + geschäftliche Kontaktmöglichkeiten aus
 * eingefügtem, geschäftlich veröffentlichtem Text (z. B. Impressum). Optional persistieren.
 * Es werden keine Daten erraten – nur der übergebene Text wird ausgewertet.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string
      links?: { href: string; text?: string }[]
      kind?: PageKind
      sourceUrl?: string
      companyId?: string
      persist?: boolean
    }
    const text = body.text || ''
    if (!text.trim()) return Response.json({ ok: false, error: 'Kein Text übergeben.' }, { status: 400 })
    const kind: PageKind = body.kind || 'impressum'
    const sourceUrl = body.sourceUrl || 'manuelle Eingabe'
    const extract = extractPeopleFromPage({ text, links: body.links || [], sourceUrl, kind })

    if (body.persist && body.companyId) {
      const c = getCompany(body.companyId)
      if (!c) return Response.json({ ok: false, error: 'Unternehmen nicht gefunden.' }, { status: 404 })
      persistResearch(body.companyId, {
        pagesChecked: [{ url: sourceUrl, kind, label: 'Manuelle Eingabe' }],
        results: [{ url: sourceUrl, kind, extract }],
        log: [`Manuelle Recherche eingefügt (${kind}).`]
      })
      const company = getCompany(body.companyId)!
      const people = listPeople(body.companyId)
      return Response.json({ ok: true, extract, company, people, summary: buildPeopleSummary(company, people) })
    }
    return Response.json({ ok: true, extract })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
