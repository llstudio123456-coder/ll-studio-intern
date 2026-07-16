import type { SavedPreview } from '@shared/types'
import { listPreviews, savePreview } from '@/server/services/savedPreviewsStorage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(listPreviews())
}

export async function POST(req: Request) {
  const body = (await req.json()) as Omit<SavedPreview, 'id' | 'createdAt'> & Partial<Pick<SavedPreview, 'id' | 'createdAt'>>
  const preview: SavedPreview = {
    ...body,
    id: body.id || 'pv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: body.createdAt || new Date().toISOString()
  }
  savePreview(preview)
  return Response.json({ ok: true, preview: { id: preview.id, createdAt: preview.createdAt } })
}
