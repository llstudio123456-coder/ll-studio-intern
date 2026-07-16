import type { CompanyPerson } from '@shared/kundenfinder'
import { getPerson, updatePerson } from '@/server/services/kundenfinder/peopleRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const person = getPerson(id)
  if (!person) return Response.json({ ok: false, error: 'Person nicht gefunden.' }, { status: 404 })
  return Response.json({ ok: true, person })
}

/** Manuelle Bearbeitung: Name, Rolle, Abteilung, Notiz, Kontakt-/Sperrstatus. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const patch = (await req.json()) as Partial<CompanyPerson>
  const person = updatePerson(id, patch)
  if (!person) return Response.json({ ok: false, error: 'Person nicht gefunden.' }, { status: 404 })
  return Response.json({ ok: true, person })
}
