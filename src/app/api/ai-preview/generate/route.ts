import type { AIPreviewRequest } from '@shared/types'
import { generateAIPreview } from '@/server/services/aiPreviewProviderService'

export const runtime = 'nodejs'
export const maxDuration = 180
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AIPreviewRequest
    if (!body?.result || !body?.source || !body?.inspiration)
      return Response.json({ ok: false, error: 'Analyse-Daten fehlen (source/inspiration/result).' }, { status: 400 })
    const result = await generateAIPreview(body)
    return Response.json({ ok: true, result })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
