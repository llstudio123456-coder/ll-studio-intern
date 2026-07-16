import { randomUUID } from 'crypto'
import { getDb } from '../kundenfinder/db'
import { normalizeName, sanitizeName, deleteObject } from './storage'
import type { Crumb, FileNode, FileVersionNode, FolderNode, Listing } from '@shared/workspace'
import { TRASH_RETENTION_DAYS } from '@shared/workspace'

const now = () => new Date().toISOString()

/* eslint-disable @typescript-eslint/no-explicit-any */
const toFolder = (r: any): FolderNode => ({
  id: r.id,
  parentId: r.parent_id || null,
  name: r.name,
  createdBy: r.created_by || undefined,
  createdAt: r.created_at,
  deletedAt: r.deleted_at || undefined
})
const toFile = (r: any): FileNode => ({
  id: r.id,
  folderId: r.folder_id || null,
  name: r.name,
  mime: r.mime,
  size: r.size,
  version: r.version,
  createdBy: r.created_by || undefined,
  createdAt: r.created_at,
  updatedBy: r.updated_by || undefined,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at || undefined
})
const toVersion = (r: any): FileVersionNode => ({
  id: r.id,
  fileId: r.file_id,
  version: r.version,
  size: r.size,
  mime: r.mime,
  comment: r.comment || undefined,
  createdBy: r.created_by || undefined,
  createdAt: r.created_at
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export function getFolder(id: string): FolderNode | null {
  const r = getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id)
  return r ? toFolder(r) : null
}
export function getFile(id: string): FileNode | null {
  const r = getDb().prepare('SELECT * FROM files WHERE id = ?').get(id)
  return r ? toFile(r) : null
}
export function getStorageKey(fileId: string): string | null {
  const r = getDb().prepare('SELECT storage_key FROM files WHERE id = ?').get(fileId) as { storage_key?: string } | undefined
  return r?.storage_key || null
}

/** Pfad vom Wurzelordner bis hierher. Bricht bei Zyklen ab, statt endlos zu laufen. */
export function crumbsFor(folderId: string | null): Crumb[] {
  const out: Crumb[] = []
  let cur = folderId
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const f = getFolder(cur)
    if (!f) break
    out.unshift({ id: f.id, name: f.name })
    cur = f.parentId
  }
  out.unshift({ id: null, name: 'LL Studio Workspace' })
  return out
}

export function listFolder(folderId: string | null): Listing {
  const db = getDb()
  const folders = db
    .prepare('SELECT * FROM folders WHERE IFNULL(parent_id,\'\') = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE')
    .all(folderId || '')
    .map(toFolder)
  const files = db
    .prepare('SELECT * FROM files WHERE IFNULL(folder_id,\'\') = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE')
    .all(folderId || '')
    .map(toFile)
  const crumbs = crumbsFor(folderId)
  return { folder: crumbs[crumbs.length - 1], crumbs, folders, files }
}

/* ── Ordner ── */

export function createFolder(parentId: string | null, rawName: string, by: string | null): FolderNode {
  const name = sanitizeName(rawName)
  const id = randomUUID()
  getDb()
    .prepare('INSERT INTO folders (id,parent_id,name,name_norm,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, parentId, name, normalizeName(name), by, now())
  return getFolder(id)!
}

export function renameFolder(id: string, rawName: string): FolderNode | null {
  const name = sanitizeName(rawName)
  getDb().prepare('UPDATE folders SET name=?, name_norm=? WHERE id=?').run(name, normalizeName(name), id)
  return getFolder(id)
}

/**
 * Verschiebt einen Ordner. Verweigert, wenn das Ziel ein Nachfahre wäre — sonst entsteht ein
 * abgekoppelter Kreis, der aus der Oberfläche nie wieder erreichbar ist.
 */
export function moveFolder(id: string, newParentId: string | null): { ok: boolean; error?: string } {
  if (id === newParentId) return { ok: false, error: 'Ein Ordner kann nicht in sich selbst liegen.' }
  if (isDescendant(newParentId, id)) return { ok: false, error: 'Ein Ordner kann nicht in einen eigenen Unterordner verschoben werden.' }
  getDb().prepare('UPDATE folders SET parent_id=? WHERE id=?').run(newParentId, id)
  return { ok: true }
}

/** Ist `candidate` ein Nachfahre von `ancestorId` (oder er selbst)? */
export function isDescendant(candidate: string | null, ancestorId: string): boolean {
  let cur = candidate
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    if (cur === ancestorId) return true
    seen.add(cur)
    cur = getFolder(cur)?.parentId ?? null
  }
  return false
}

/* ── Dateien ── */

export function createFile(p: {
  folderId: string | null
  name: string
  mime: string
  size: number
  storageKey: string
  sha256: string
  by: string | null
}): FileNode {
  const db = getDb()
  const id = randomUUID()
  const t = now()
  const name = sanitizeName(p.name)
  db.prepare(
    `INSERT INTO files (id,folder_id,name,name_norm,mime,size,storage_key,version,sha256,created_by,created_at,updated_by,updated_at)
     VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?)`
  ).run(id, p.folderId, name, normalizeName(name), p.mime, p.size, p.storageKey, p.sha256, p.by, t, p.by, t)
  db.prepare(
    'INSERT INTO file_versions (id,file_id,version,storage_key,size,mime,sha256,comment,created_by,created_at) VALUES (?,?,1,?,?,?,?,?,?,?)'
  ).run(randomUUID(), id, p.storageKey, p.size, p.mime, p.sha256, 'Erste Fassung', p.by, t)
  return getFile(id)!
}

/** Neue Fassung einer bestehenden Datei. Die alte Version bleibt vollständig erhalten. */
export function addVersion(p: {
  fileId: string
  mime: string
  size: number
  storageKey: string
  sha256: string
  comment?: string
  by: string | null
}): FileNode | null {
  const db = getDb()
  const file = getFile(p.fileId)
  if (!file) return null
  const version = file.version + 1
  const t = now()
  db.prepare('UPDATE files SET storage_key=?, size=?, mime=?, sha256=?, version=?, updated_by=?, updated_at=? WHERE id=?')
    .run(p.storageKey, p.size, p.mime, p.sha256, version, p.by, t, p.fileId)
  db.prepare(
    'INSERT INTO file_versions (id,file_id,version,storage_key,size,mime,sha256,comment,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(randomUUID(), p.fileId, version, p.storageKey, p.size, p.mime, p.sha256, p.comment || null, p.by, t)
  return getFile(p.fileId)
}

export function listVersions(fileId: string): FileVersionNode[] {
  return getDb().prepare('SELECT * FROM file_versions WHERE file_id=? ORDER BY version DESC').all(fileId).map(toVersion)
}

/**
 * Stellt eine alte Version wieder her — als NEUE Version.
 * Die Historie wird dabei bewusst nicht überschrieben: Auch die Wiederherstellung ist ein Schritt,
 * der sich zurücknehmen lassen muss.
 */
export function restoreVersion(fileId: string, version: number, by: string | null): FileNode | null {
  const db = getDb()
  const v = db.prepare('SELECT * FROM file_versions WHERE file_id=? AND version=?').get(fileId, version) as
    | { storage_key: string; size: number; mime: string; sha256: string | null }
    | undefined
  if (!v) return null
  // Bewusst derselbe storage_key: Der Inhalt ist identisch, ihn ein zweites Mal auf die Platte zu
  // schreiben wäre Verschwendung. deleteVersionsOf() räumt erst beim endgültigen Löschen auf.
  return addVersion({
    fileId,
    mime: v.mime,
    size: v.size,
    storageKey: v.storage_key,
    sha256: v.sha256 || '',
    comment: `Wiederhergestellt aus Version ${version}`,
    by
  })
}

export function renameFile(id: string, rawName: string, by: string | null): FileNode | null {
  const name = sanitizeName(rawName)
  getDb().prepare('UPDATE files SET name=?, name_norm=?, updated_by=?, updated_at=? WHERE id=?')
    .run(name, normalizeName(name), by, now(), id)
  return getFile(id)
}

export function moveFile(id: string, folderId: string | null, by: string | null): FileNode | null {
  getDb().prepare('UPDATE files SET folder_id=?, updated_by=?, updated_at=? WHERE id=?').run(folderId, by, now(), id)
  return getFile(id)
}

/* ── Papierkorb ── */

export function trashFile(id: string, by: string | null): void {
  getDb().prepare('UPDATE files SET deleted_at=?, deleted_by=? WHERE id=?').run(now(), by, id)
}
export function trashFolder(id: string, by: string | null): void {
  // Der Ordner selbst reicht: listFolder blendet gelöschte Ordner aus, damit verschwindet der
  // ganze Teilbaum aus der Ansicht und taucht beim Wiederherstellen vollständig wieder auf.
  getDb().prepare('UPDATE folders SET deleted_at=?, deleted_by=? WHERE id=?').run(now(), by, id)
}
export function restoreFile(id: string): void {
  getDb().prepare('UPDATE files SET deleted_at=NULL, deleted_by=NULL WHERE id=?').run(id)
}
export function restoreFolder(id: string): void {
  getDb().prepare('UPDATE folders SET deleted_at=NULL, deleted_by=NULL WHERE id=?').run(id)
}

export function listTrash(): { folders: FolderNode[]; files: FileNode[] } {
  const db = getDb()
  return {
    folders: db.prepare('SELECT * FROM folders WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all().map(toFolder),
    files: db.prepare('SELECT * FROM files WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all().map(toFile)
  }
}

/** Endgültiges Löschen einer Datei samt aller Versionen — auch von der Platte. */
export async function purgeFile(id: string): Promise<void> {
  const db = getDb()
  const keys = db.prepare('SELECT DISTINCT storage_key FROM file_versions WHERE file_id=?').all(id) as { storage_key: string }[]
  const current = db.prepare('SELECT storage_key FROM files WHERE id=?').get(id) as { storage_key?: string } | undefined
  const all = new Set(keys.map((k) => k.storage_key))
  if (current?.storage_key) all.add(current.storage_key)
  db.prepare('DELETE FROM files WHERE id=?').run(id) // file_versions hängen per ON DELETE CASCADE
  for (const k of all) await deleteObject(k)
}

export async function purgeFolder(id: string): Promise<void> {
  const db = getDb()
  const files = db.prepare('SELECT id FROM files WHERE folder_id=?').all(id) as { id: string }[]
  for (const f of files) await purgeFile(f.id)
  const subs = db.prepare('SELECT id FROM folders WHERE parent_id=?').all(id) as { id: string }[]
  for (const s of subs) await purgeFolder(s.id)
  db.prepare('DELETE FROM folders WHERE id=?').run(id)
}

/** Ist der Eintrag lange genug im Papierkorb, dass er automatisch verfallen darf? */
export function isExpired(deletedAt?: string): boolean {
  if (!deletedAt) return false
  return Date.now() - new Date(deletedAt).getTime() > TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
}

/** Gesamtbelegung (nur aktuelle Fassungen — das ist die Zahl, die Mitarbeiter erwarten). */
export function storageUsed(): number {
  const r = getDb().prepare('SELECT IFNULL(SUM(size),0) AS n FROM files WHERE deleted_at IS NULL').get() as { n: number }
  return r.n
}
