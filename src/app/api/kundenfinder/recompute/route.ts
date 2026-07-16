import { recomputeAll } from '@/server/services/kundenfinder/companiesRepo'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Prioritäten/Kontaktvollständigkeit/KI-Notizen für bestehende Unternehmen neu berechnen (ändert keine Analysedaten). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { savedOnly?: boolean }
    const res = recomputeAll({ savedOnly: !!body.savedOnly })
    return Response.json({ ok: true, ...res })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
