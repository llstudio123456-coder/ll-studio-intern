import type { SavedProjectPalette } from '@shared/types'
import { loadProjectPalette, saveProjectPalette } from '@/server/services/projectPaletteStorage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('project') || ''
  return Response.json(loadProjectPalette(id))
}

export async function POST(req: Request) {
  const body = (await req.json()) as SavedProjectPalette
  saveProjectPalette({ ...body, updatedAt: new Date().toISOString() })
  return Response.json({ ok: true })
}
