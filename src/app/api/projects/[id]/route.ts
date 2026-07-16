import { loadProject, deleteProject } from '@/server/services/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = loadProject(id)
  if (!project) return new Response('not found', { status: 404 })
  return Response.json(project)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return Response.json({ ok: deleteProject(id) })
}
