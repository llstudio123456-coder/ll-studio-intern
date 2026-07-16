import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { roleAtLeast } from '@shared/auth'
import {
  getFile, getStorageKey, renameFile, moveFile, trashFile, restoreFile, purgeFile,
  getFolder, restoreVersion
} from '@/server/services/workspace/filesRepo'
import { getObject, ALLOWED_TYPES, extensionOf } from '@/server/services/workspace/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Download.
 *
 * Der Zugriff wird bei JEDEM Abruf serverseitig geprüft — es gibt keine erratbaren Pfade und
 * keine öffentliche URL: Die Datei liegt unter einer UUID auf dem Volume und wird ausschließlich
 * durch diese Route ausgeliefert.
 *
 * Der Content-Type kommt aus unserer Positivliste, nie aus der Datei oder vom Client. Typen mit
 * XSS-Potenzial (SVG, HTML, JS, CSS) werden als text/plain und mit Content-Disposition: attachment
 * ausgeliefert, damit sie auf unserer Domain niemals ausgeführt werden können.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response

  const { id } = await ctx.params
  const file = getFile(id)
  if (!file || file.deletedAt) return Response.json({ ok: false, error: 'Die Datei wurde nicht gefunden.' }, { status: 404 })

  const key = getStorageKey(id)
  if (!key) return Response.json({ ok: false, error: 'Die Datei wurde nicht gefunden.' }, { status: 404 })

  let buf: Buffer
  try {
    buf = await getObject(key)
  } catch {
    return Response.json({ ok: false, error: 'Der Inhalt ist nicht mehr verfügbar.' }, { status: 410 })
  }

  const type = ALLOWED_TYPES[extensionOf(file.name)]
  const inline = new URL(req.url).searchParams.get('inline') === '1' && type && !type.forceDownload
  const disposition = inline ? 'inline' : 'attachment'
  // RFC 5987, damit Umlaute im Dateinamen den Header nicht zerlegen.
  const encoded = encodeURIComponent(file.name)

  audit('file_downloaded', { userId: g.user?.id ?? undefined, email: g.user?.email, resource: file.id, meta: { name: file.name } })

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': type?.serve || 'application/octet-stream',
      'Content-Length': String(buf.length),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encoded}`,
      // Niemals in einen fremden Rahmen, niemals Typ-Raten durch den Browser.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store'
    }
  })
}

interface Body {
  action?: 'rename' | 'move' | 'trash' | 'restore' | 'purge' | 'restoreVersion'
  name?: string
  folderId?: string | null
  version?: number
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  const actor = g.user

  const { id } = await ctx.params
  const file = getFile(id)
  if (!file) return Response.json({ ok: false, error: 'Die Datei wurde nicht gefunden.' }, { status: 404 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  switch (body.action) {
    case 'rename': {
      if (!body.name?.trim()) return Response.json({ ok: false, error: 'Kein Name angegeben.' }, { status: 400 })
      const r = guarded(() => renameFile(id, body.name!, actor?.id ?? null))
      if (!r.ok) return r.response
      break
    }
    case 'move': {
      const target = body.folderId ?? null
      if (target && !getFolder(target)) return Response.json({ ok: false, error: 'Der Zielordner wurde nicht gefunden.' }, { status: 404 })
      const r = guarded(() => moveFile(id, target, actor?.id ?? null))
      if (!r.ok) return r.response
      break
    }
    case 'trash':
      trashFile(id, actor?.id ?? null)
      break
    case 'restore':
      restoreFile(id)
      break
    case 'purge': {
      // Endgültiges Löschen ist Admin-Sache (Spezifikation §18).
      if (!roleAtLeast(actor?.role, 'admin')) {
        return Response.json({ ok: false, error: 'Endgültiges Löschen ist Administratoren vorbehalten.' }, { status: 403 })
      }
      await purgeFile(id)
      audit('file_purged', { userId: actor?.id, email: actor?.email, resource: id, meta: { name: file.name } })
      return Response.json({ ok: true })
    }
    case 'restoreVersion': {
      if (!body.version) return Response.json({ ok: false, error: 'Keine Version angegeben.' }, { status: 400 })
      const node = restoreVersion(id, body.version, actor?.id ?? null)
      if (!node) return Response.json({ ok: false, error: 'Diese Version gibt es nicht.' }, { status: 404 })
      audit('file_version_restored', { userId: actor?.id, email: actor?.email, resource: id, meta: { version: body.version } })
      return Response.json({ ok: true, file: node })
    }
    default:
      return Response.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
  }

  audit(`file_${body.action}`, { userId: actor?.id, email: actor?.email, resource: id, meta: { name: file.name } })
  return Response.json({ ok: true, file: getFile(id) })
}

/** Fängt die UNIQUE-Verletzung ab, wenn im Zielordner schon etwas gleichen Namens liegt. */
function guarded<T>(fn: () => T): { ok: true; value: T } | { ok: false; response: Response } {
  try {
    return { ok: true, value: fn() }
  } catch (e) {
    const msg = String(e).includes('UNIQUE')
      ? 'In diesem Ordner gibt es bereits einen Eintrag mit diesem Namen.'
      : 'Die Aktion konnte nicht ausgeführt werden.'
    return { ok: false, response: Response.json({ ok: false, error: msg }, { status: 409 }) }
  }
}
