import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { listFolder, createFile, addVersion, getFolder } from '@/server/services/workspace/filesRepo'
import { validateUpload, newStorageKey, putObject, sha256, sanitizeName, normalizeName, MAX_FILE_SIZE } from '@/server/services/workspace/storage'
import { getDb } from '@/server/services/kundenfinder/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Inhalt eines Ordners. Ab Rolle „viewer" — Lesen ist allen Freigeschalteten erlaubt. */
export async function GET(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response

  const url = new URL(req.url)
  const folderParam = url.searchParams.get('folder')
  const folderId = folderParam && folderParam !== 'root' ? folderParam : null

  // Existiert der Ordner überhaupt? Sonst zeigt die Oberfläche kommentarlos den Wurzelordner
  // und der Benutzer wundert sich.
  if (folderId && !getFolder(folderId)) {
    return Response.json({ ok: false, error: 'Der Ordner wurde nicht gefunden.' }, { status: 404 })
  }

  return Response.json({ ok: true, ...listFolder(folderId) })
}

/**
 * Datei hochladen (multipart/form-data).
 *
 * Jede Datei wird serverseitig geprüft: Endung gegen Positivliste, Inhalt gegen Magic Bytes,
 * Größe gegen das Limit. Der vom Browser behauptete Content-Type wird bewusst ignoriert.
 * Existiert im Zielordner bereits eine Datei gleichen Namens, entsteht eine neue VERSION,
 * statt die alte zu überschreiben.
 */
export async function POST(req: Request) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  const by = g.user?.id ?? null

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ ok: false, error: 'Der Upload konnte nicht gelesen werden.' }, { status: 400 })
  }

  const folderParam = String(form.get('folder') || '')
  const folderId = folderParam && folderParam !== 'root' ? folderParam : null
  if (folderId && !getFolder(folderId)) {
    return Response.json({ ok: false, error: 'Der Zielordner wurde nicht gefunden.' }, { status: 404 })
  }

  const entries = form.getAll('file').filter((f): f is File => f instanceof File)
  if (entries.length === 0) return Response.json({ ok: false, error: 'Keine Datei übermittelt.' }, { status: 400 })

  const saved: unknown[] = []
  const rejected: { name: string; error: string }[] = []

  for (const f of entries) {
    // Vor dem Einlesen abbrechen, statt erst 500 MB in den Speicher zu ziehen.
    if (f.size > MAX_FILE_SIZE) {
      rejected.push({ name: f.name, error: `Zu groß (max. ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB).` })
      continue
    }
    const buf = Buffer.from(await f.arrayBuffer())
    const v = validateUpload(f.name, buf)
    if (!v.ok) {
      audit('file_upload_rejected', { userId: by ?? undefined, email: g.user?.email, success: false, meta: { name: f.name, reason: v.error } })
      rejected.push({ name: sanitizeName(f.name), error: v.error! })
      continue
    }

    const key = newStorageKey()
    await putObject(key, buf)
    const digest = sha256(buf)
    const name = sanitizeName(f.name)

    const existing = getDb()
      .prepare('SELECT id FROM files WHERE IFNULL(folder_id,\'\') = ? AND name_norm = ? AND deleted_at IS NULL')
      .get(folderId || '', normalizeName(name)) as { id: string } | undefined

    const node = existing
      ? addVersion({ fileId: existing.id, mime: v.mime!, size: buf.length, storageKey: key, sha256: digest, comment: 'Neue Fassung hochgeladen', by })
      : createFile({ folderId, name, mime: v.mime!, size: buf.length, storageKey: key, sha256: digest, by })

    audit(existing ? 'file_version_added' : 'file_uploaded', { userId: by ?? undefined, email: g.user?.email, resource: node?.id, meta: { name, size: buf.length } })
    saved.push(node)
  }

  return Response.json({ ok: rejected.length === 0, saved, rejected }, { status: saved.length === 0 ? 400 : 200 })
}
