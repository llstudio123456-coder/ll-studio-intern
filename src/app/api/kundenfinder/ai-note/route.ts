import { qualifyCompany, setAiNote, getCompany } from '@/server/services/kundenfinder/companiesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** KI-Website-Notiz neu generieren ('regenerate') oder manuell bearbeitete Notiz speichern ('save'). */
export async function POST(req: Request) {
  try {
    const { id, action, note } = (await req.json()) as { id: string; action: 'regenerate' | 'save'; note?: string }
    if (!id || !getCompany(id)) return Response.json({ ok: false, error: 'Unternehmen nicht gefunden.' }, { status: 404 })
    if (action === 'save') {
      if (note == null) return Response.json({ ok: false, error: 'Notiz fehlt.' }, { status: 400 })
      return Response.json({ ok: true, company: setAiNote(id, note) })
    }
    const company = qualifyCompany(id, { regenerateNote: true })
    return Response.json({ ok: true, company })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
