import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { createFolder, getFolder } from '@/server/services/workspace/filesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  const actor = g.user

  let body: { name?: string; parentId?: string | null } = {}
  try {
    body = await req.json()
  } catch {
    /* ignore */
  }
  if (!body.name?.trim()) return Response.json({ ok: false, error: 'Kein Name angegeben.' }, { status: 400 })

  const parentId = body.parentId ?? null
  if (parentId && !getFolder(parentId)) {
    return Response.json({ ok: false, error: 'Der übergeordnete Ordner wurde nicht gefunden.' }, { status: 404 })
  }

  try {
    const folder = createFolder(parentId, body.name, actor?.id ?? null)
    audit('folder_created', { userId: actor?.id, email: actor?.email, resource: folder.id, meta: { name: folder.name } })
    return Response.json({ ok: true, folder })
  } catch (e) {
    const msg = String(e).includes('UNIQUE')
      ? 'In diesem Ordner gibt es bereits einen Eintrag mit diesem Namen.'
      : 'Der Ordner konnte nicht angelegt werden.'
    return Response.json({ ok: false, error: msg }, { status: 409 })
  }
}
