import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { roleAtLeast } from '@shared/auth'
import { getFolder, renameFolder, moveFolder, trashFolder, restoreFolder, purgeFolder } from '@/server/services/workspace/filesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  action?: 'rename' | 'move' | 'trash' | 'restore' | 'purge'
  name?: string
  parentId?: string | null
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  const actor = g.user

  const { id } = await ctx.params
  const folder = getFolder(id)
  if (!folder) return Response.json({ ok: false, error: 'Der Ordner wurde nicht gefunden.' }, { status: 404 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  try {
    switch (body.action) {
      case 'rename':
        if (!body.name?.trim()) return Response.json({ ok: false, error: 'Kein Name angegeben.' }, { status: 400 })
        renameFolder(id, body.name)
        break
      case 'move': {
        const target = body.parentId ?? null
        if (target && !getFolder(target)) return Response.json({ ok: false, error: 'Der Zielordner wurde nicht gefunden.' }, { status: 404 })
        // Verhindert den abgekoppelten Kreis: Ordner in sich selbst oder in einen eigenen
        // Unterordner zu schieben würde den Teilbaum unerreichbar machen.
        const r = moveFolder(id, target)
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 })
        break
      }
      case 'trash':
        trashFolder(id, actor?.id ?? null)
        break
      case 'restore':
        restoreFolder(id)
        break
      case 'purge': {
        if (!roleAtLeast(actor?.role, 'admin')) {
          return Response.json({ ok: false, error: 'Endgültiges Löschen ist Administratoren vorbehalten.' }, { status: 403 })
        }
        await purgeFolder(id)
        audit('folder_purged', { userId: actor?.id, email: actor?.email, resource: id, meta: { name: folder.name } })
        return Response.json({ ok: true })
      }
      default:
        return Response.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
    }
  } catch (e) {
    const msg = String(e).includes('UNIQUE')
      ? 'In diesem Ordner gibt es bereits einen Eintrag mit diesem Namen.'
      : 'Die Aktion konnte nicht ausgeführt werden.'
    return Response.json({ ok: false, error: msg }, { status: 409 })
  }

  audit(`folder_${body.action}`, { userId: actor?.id, email: actor?.email, resource: id, meta: { name: folder.name } })
  return Response.json({ ok: true, folder: getFolder(id) })
}
