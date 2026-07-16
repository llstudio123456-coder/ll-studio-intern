import { addActivity, getCompany } from '@/server/services/kundenfinder/companiesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Kontaktaktivität dokumentieren (angerufen, E-Mail versendet, Termin …). Keine automatische Versendung. */
export async function POST(req: Request) {
  try {
    const { id, type, note, nextStep, followup } = (await req.json()) as { id: string; type: string; note?: string; nextStep?: string; followup?: string }
    if (!id || !getCompany(id)) return Response.json({ ok: false, error: 'Unternehmen nicht gefunden.' }, { status: 404 })
    if (!type) return Response.json({ ok: false, error: 'Aktivitätstyp fehlt.' }, { status: 400 })
    addActivity(id, type, note, nextStep, followup)
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
