import type { PromptGenerationInput } from '@shared/types'
import { generatePrompt } from '@/server/services/promptGeneratorService'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as PromptGenerationInput
    const result = await generatePrompt(input)
    return Response.json({ ok: true, result })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
