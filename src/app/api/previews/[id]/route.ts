import { loadPreview, deletePreview } from '@/server/services/savedPreviewsStorage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = loadPreview(id)
  if (!p) return new Response('not found', { status: 404 })
  return Response.json(p)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return Response.json({ ok: deletePreview(id) })
}
