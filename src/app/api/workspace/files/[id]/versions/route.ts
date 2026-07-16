import { guardApi } from '@/server/auth/guard'
import { getFile, listVersions } from '@/server/services/workspace/filesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Versionsverlauf einer Datei. Enthält keine Speicherschlüssel — die gehen den Client nichts an. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response

  const { id } = await ctx.params
  if (!getFile(id)) return Response.json({ ok: false, error: 'Die Datei wurde nicht gefunden.' }, { status: 404 })

  return Response.json({ ok: true, versions: listVersions(id) })
}
