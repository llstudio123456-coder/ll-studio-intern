import type { Company } from '@shared/kundenfinder'
import { getCompany, updateCompany, listNotes, listHistory, latestAnalysis, listActivities } from '@/server/services/kundenfinder/companiesRepo'
import { listPeople, listConflicts, buildPeopleSummary } from '@/server/services/kundenfinder/peopleRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = getCompany(id)
  if (!company) return Response.json({ ok: false, error: 'Unternehmen nicht gefunden.' }, { status: 404 })
  const people = listPeople(id)
  const preferred = people.find((p) => p.id === company.preferredPersonId) || people.find((p) => p.isPreferredContact) || null
  return Response.json({
    ok: true, company, notes: listNotes(id), history: listHistory(id), analysis: latestAnalysis(id), activities: listActivities(id),
    people, preferred, conflicts: listConflicts(id), peopleSummary: buildPeopleSummary(company, people)
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const patch = (await req.json()) as Partial<Company>
  const company = updateCompany(id, patch)
  if (!company) return Response.json({ ok: false, error: 'Unternehmen nicht gefunden.' }, { status: 404 })
  return Response.json({ ok: true, company })
}
