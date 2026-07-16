import type { SavedPrompt } from '@shared/types'
import { listPrompts, savePrompt } from '@/server/services/savedPromptsStorage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(listPrompts())
}

export async function POST(req: Request) {
  const body = (await req.json()) as Omit<SavedPrompt, 'id' | 'createdAt'> & Partial<Pick<SavedPrompt, 'id' | 'createdAt'>>
  const prompt: SavedPrompt = {
    ...body,
    id: body.id || 'pr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: body.createdAt || new Date().toISOString()
  }
  savePrompt(prompt)
  return Response.json({ ok: true, prompt })
}
