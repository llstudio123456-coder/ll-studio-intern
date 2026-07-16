import type { AIPreviewRequest } from '@shared/types'
import { buildAIPreviewPrompt } from '@/server/services/aiPreviewPromptBuilder'
import { buildManualExport, targetFromFormat } from '@/server/services/manualPromptExportService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Baut nur den Prompt (für „Prompt vorher anzeigen“/„Prompt kopieren“) – ohne KI-Aufruf. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AIPreviewRequest
    const prompt = buildAIPreviewPrompt({
      source: body.source,
      inspiration: body.inspiration,
      result: body.result,
      format: body.format,
      provider: body.provider,
      customUser: body.customPrompt
    })
    const manualExport = buildManualExport(prompt, targetFromFormat(body.format))
    return Response.json({ ok: true, prompt, manualExport })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
