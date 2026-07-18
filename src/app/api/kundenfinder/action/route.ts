import type { Company, LeadStatus } from '@shared/kundenfinder'
import { saveCompany, unsaveCompany, excludeCompany, removePermanently, addNote, getCompany, setWebsiteStateManual } from '@/server/services/kundenfinder/companiesRepo'
import { guardApi } from '@/server/auth/guard'
import { roleAtLeast } from '@shared/auth'
import { audit } from '@/server/auth/repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Sammel-Endpoint für Lead-Aktionen: speichern, aus gespeicherten entfernen, ausschließen,
 * endgültig löschen, Notiz.
 *
 * Rollen werden serverseitig geprüft (Spezifikation §4). Das Ausblenden eines Buttons genügt
 * nicht — ein Viewer/Gast darf auch über eine manipulierte Anfrage nichts entfernen.
 */
export async function POST(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  // Lokal (unkonfiguriert) liefert guardApi user=null → offener Entwicklungsmodus, alles erlaubt.
  const role = g.user?.role
  const actor = g.user?.id || 'system'
  // Verändern (speichern/entfernen/Notiz) ab 'member'; ein reiner Viewer/Gast darf nur lesen.
  const mayModify = !g.user || roleAtLeast(role, 'member')
  // Endgültiges Löschen inkl. Dubletten-Schutz ist Admin-Sache.
  const mayDelete = !g.user || roleAtLeast(role, 'admin')

  try {
    const body = (await req.json()) as { action: string; id: string; reason?: string; status?: LeadStatus; note?: string; dialog?: Partial<Company>; websiteState?: string | null }
    const { action, id } = body
    if (!id) return Response.json({ ok: false, error: 'id fehlt.' }, { status: 400 })

    if (action === 'save') {
      if (!mayModify) return forbidden()
      const c = saveCompany(id, body.dialog || {}, actor)
      return Response.json({ ok: !!c, company: c })
    }
    if (action === 'unsave') {
      // „Aus gespeicherten Kunden entfernen" — nur der Speicherstatus, keine Datenlöschung.
      if (!mayModify) return forbidden()
      const c = unsaveCompany(id)
      if (c) audit('company_unsaved', { userId: g.user?.id, email: g.user?.email, resource: id })
      return Response.json({ ok: !!c, company: c })
    }
    if (action === 'website_state') {
      // Manuelle Korrektur des Website-Zustands (§15) — hat Vorrang vor der Auto-Erkennung.
      if (!mayModify) return forbidden()
      const c = setWebsiteStateManual(id, body.websiteState ?? null, actor)
      return Response.json({ ok: !!c, company: c })
    }
    if (action === 'exclude') {
      if (!mayModify) return forbidden()
      const c = excludeCompany(id, body.reason || 'nicht geeignet', (body.status as LeadStatus) || 'nicht_geeignet', actor)
      return Response.json({ ok: !!c, company: c })
    }
    if (action === 'note') {
      if (!mayModify) return forbidden()
      if (!body.note?.trim()) return Response.json({ ok: false, error: 'Notiz leer.' }, { status: 400 })
      addNote(id, body.note.trim(), actor)
      return Response.json({ ok: true })
    }
    if (action === 'remove') {
      // Geschützte Aktion: vollständige Entfernung inkl. Dubletten-Schutz — nur Admin/Owner.
      if (!mayDelete) return forbidden('Endgültiges Löschen ist Administratoren vorbehalten.')
      const existed = !!getCompany(id)
      const done = removePermanently(id)
      if (done) audit('company_removed', { userId: g.user?.id, email: g.user?.email, resource: id })
      return Response.json({ ok: done, existed })
    }
    return Response.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

const forbidden = (msg = 'Für diese Aktion fehlt die Berechtigung.') =>
  Response.json({ ok: false, error: msg }, { status: 403 })
