import type { SearchParams } from '@shared/kundenfinder'
import { runSearch } from '@/server/services/kundenfinder/searchService'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const params = (await req.json()) as SearchParams
    if (!params?.industry && !params?.keyword) return Response.json({ ok: false, error: 'Bitte Branche oder Suchbegriff angeben.' }, { status: 400 })
    if (!params?.city && !params?.plz && !params?.region) return Response.json({ ok: false, error: 'Bitte Ort, PLZ oder Region angeben.' }, { status: 400 })
    const summary = await runSearch(params)
    return Response.json({ ok: true, summary })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
