import type { Company, LeadStatus } from '@shared/kundenfinder'
import { saveCompany, excludeCompany, removePermanently, addNote, getCompany } from '@/server/services/kundenfinder/companiesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sammel-Endpoint für einfache Lead-Aktionen: speichern, ausschließen, löschen, Notiz. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: string; id: string; reason?: string; status?: LeadStatus; note?: string; dialog?: Partial<Company> }
    const { action, id } = body
    if (!id) return Response.json({ ok: false, error: 'id fehlt.' }, { status: 400 })

    if (action === 'save') {
      const c = saveCompany(id, body.dialog || {})
      return Response.json({ ok: !!c, company: c })
    }
    if (action === 'exclude') {
      const c = excludeCompany(id, body.reason || 'nicht geeignet', (body.status as LeadStatus) || 'nicht_geeignet')
      return Response.json({ ok: !!c, company: c })
    }
    if (action === 'note') {
      if (!body.note?.trim()) return Response.json({ ok: false, error: 'Notiz leer.' }, { status: 400 })
      addNote(id, body.note.trim())
      return Response.json({ ok: true })
    }
    if (action === 'remove') {
      // Geschützte Aktion: vollständige Entfernung inkl. Dubletten-Schutz
      const existed = !!getCompany(id)
      const done = removePermanently(id)
      return Response.json({ ok: done, existed })
    }
    return Response.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
