import { randomUUID } from 'crypto'
import { getDb } from '../kundenfinder/db'
import { ROLE_RANK, type Role } from '@shared/auth'
import type { Note, NoteKind, NoteShare, NoteVisibility } from '@shared/notes'

const now = () => new Date().toISOString()

export interface Actor {
  id: string
  role: Role
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toNote = (r: any): Note => ({
  id: r.id,
  kind: r.kind as NoteKind,
  title: r.title || undefined,
  body: r.body ?? '',
  visibility: r.visibility as NoteVisibility,
  ownerId: r.owner_id || undefined,
  ownerName: r.owner_name || undefined,
  companyId: r.company_id || undefined,
  companyName: r.company_name || undefined,
  tags: parseTags(r.tags),
  color: r.color || undefined,
  pinned: !!r.pinned,
  favorite: !!r.favorite,
  archivedAt: r.archived_at || undefined,
  remindAt: r.remind_at || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  updatedBy: r.updated_by || undefined,
  deletedAt: r.deleted_at || undefined
})
/* eslint-enable @typescript-eslint/no-explicit-any */

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * SQL-Bedingung, die exakt die für diesen Benutzer lesbaren Notizen zulässt.
 *
 * Bewusst als WHERE-Fragment und nicht als Filter im Anschluss: Würde erst geladen und dann
 * verworfen, verrieten Ergebnisanzahl und Paginierung die Existenz fremder privater Notizen.
 * Die Regel spiegelt canReadNote() aus @shared/notes — beide müssen zusammen geändert werden.
 */
function visibilityClause(actor: Actor): { sql: string; params: unknown[] } {
  const parts: string[] = ['n.owner_id = ?']
  const params: unknown[] = [actor.id]

  // Gezielt geteilt
  parts.push("(n.visibility = 'shared' AND EXISTS (SELECT 1 FROM workspace_note_shares s WHERE s.note_id = n.id AND s.user_id = ?))")
  params.push(actor.id)

  // Unternehmensweit
  parts.push("n.visibility = 'company'")

  if (ROLE_RANK[actor.role] >= ROLE_RANK.admin) parts.push("n.visibility = 'admins'")
  if (actor.role === 'owner') parts.push("n.visibility = 'owner'")

  // 'private' taucht hier NIE auf: Fremde private Notizen bleiben unsichtbar, egal welche Rolle.
  return { sql: `(${parts.join(' OR ')})`, params }
}

const BASE_SELECT = `
  SELECT n.*, u.name AS owner_name, c.name AS company_name
  FROM workspace_notes n
  LEFT JOIN app_users u ON u.id = n.owner_id
  LEFT JOIN companies c ON c.id = n.company_id
`

export interface ListFilter {
  kind?: NoteKind
  companyId?: string
  tag?: string
  query?: string
  archived?: boolean
  favorite?: boolean
  limit?: number
  offset?: number
}

export function listNotes(actor: Actor, f: ListFilter = {}): { notes: Note[]; total: number } {
  const db = getDb()
  const vis = visibilityClause(actor)
  const where: string[] = ['n.deleted_at IS NULL', vis.sql]
  const params: unknown[] = [...vis.params]

  where.push(f.archived ? 'n.archived_at IS NOT NULL' : 'n.archived_at IS NULL')
  if (f.kind) { where.push('n.kind = ?'); params.push(f.kind) }
  if (f.companyId) { where.push('n.company_id = ?'); params.push(f.companyId) }
  if (f.favorite) where.push('n.favorite = 1')
  if (f.tag) { where.push('n.tags LIKE ?'); params.push(`%"${f.tag}"%`) }
  if (f.query?.trim()) {
    // Titel, Inhalt und Tags durchsuchen — unabhängig von Groß-/Kleinschreibung.
    where.push('(LOWER(IFNULL(n.title,\'\')) LIKE ? OR LOWER(n.body) LIKE ? OR LOWER(IFNULL(n.tags,\'\')) LIKE ?)')
    const q = `%${f.query.trim().toLowerCase()}%`
    params.push(q, q, q)
  }

  const whereSql = `WHERE ${where.join(' AND ')}`
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM workspace_notes n ${whereSql}`).get(...params) as { n: number }).n

  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200)
  const offset = Math.max(f.offset ?? 0, 0)
  const rows = db
    .prepare(`${BASE_SELECT} ${whereSql} ORDER BY n.pinned DESC, n.updated_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map(toNote)

  return { notes: rows, total }
}

/** Einzelne Notiz — nur wenn lesbar. Sonst null (die Route macht daraus ein 404). */
export function getNote(actor: Actor, id: string): Note | null {
  const db = getDb()
  const vis = visibilityClause(actor)
  const r = db.prepare(`${BASE_SELECT} WHERE n.id = ? AND n.deleted_at IS NULL AND ${vis.sql}`).get(id, ...vis.params)
  if (!r) return null
  const note = toNote(r)
  note.sharedWith = listShares(id)
  return note
}

/** Rohzugriff ohne Sichtbarkeitsfilter — nur für interne Rechteprüfungen, nie für Antworten. */
export function getNoteRaw(id: string): Note | null {
  const r = getDb().prepare('SELECT * FROM workspace_notes WHERE id = ?').get(id)
  return r ? toNote(r) : null
}

export function listShares(noteId: string): { userId: string; name?: string; canEdit: boolean }[] {
  return getDb()
    .prepare('SELECT s.user_id, s.can_edit, u.name FROM workspace_note_shares s LEFT JOIN app_users u ON u.id = s.user_id WHERE s.note_id = ?')
    .all(noteId)
    .map((r) => {
      const row = r as { user_id: string; can_edit: number; name: string | null }
      return { userId: row.user_id, name: row.name || undefined, canEdit: !!row.can_edit }
    })
}

export function sharedUserIds(noteId: string): string[] {
  return listShares(noteId).map((s) => s.userId)
}

export function createNote(actor: Actor, p: {
  kind?: NoteKind
  title?: string
  body?: string
  visibility?: NoteVisibility
  companyId?: string
  tags?: string[]
  color?: string
  remindAt?: string
}): Note {
  const id = randomUUID()
  const t = now()
  getDb()
    .prepare(
      `INSERT INTO workspace_notes (id,kind,title,body,visibility,owner_id,company_id,tags,color,remind_at,created_at,updated_at,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      id,
      p.kind || 'persoenlich',
      p.title?.trim() || null,
      p.body ?? '',
      p.visibility || 'private',
      actor.id,
      p.companyId || null,
      JSON.stringify(p.tags || []),
      p.color || null,
      p.remindAt || null,
      t,
      t,
      actor.id
    )
  return getNote(actor, id)!
}

export function updateNote(actor: Actor, id: string, p: Partial<{
  kind: NoteKind
  title: string
  body: string
  visibility: NoteVisibility
  companyId: string | null
  tags: string[]
  color: string | null
  remindAt: string | null
  pinned: boolean
  favorite: boolean
}>): Note | null {
  const db = getDb()
  const sets: string[] = []
  const params: unknown[] = []
  const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); params.push(v) }

  if (p.kind !== undefined) put('kind', p.kind)
  if (p.title !== undefined) put('title', p.title.trim() || null)
  if (p.body !== undefined) put('body', p.body)
  if (p.visibility !== undefined) put('visibility', p.visibility)
  if (p.companyId !== undefined) put('company_id', p.companyId || null)
  if (p.tags !== undefined) put('tags', JSON.stringify(p.tags))
  if (p.color !== undefined) put('color', p.color)
  if (p.remindAt !== undefined) put('remind_at', p.remindAt)
  if (p.pinned !== undefined) put('pinned', p.pinned ? 1 : 0)
  if (p.favorite !== undefined) put('favorite', p.favorite ? 1 : 0)
  if (sets.length === 0) return getNote(actor, id)

  put('updated_at', now())
  put('updated_by', actor.id)
  db.prepare(`UPDATE workspace_notes SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
  return getNote(actor, id)
}

export function setShares(noteId: string, shares: NoteShare[]): void {
  const db = getDb()
  const t = now()
  db.prepare('DELETE FROM workspace_note_shares WHERE note_id = ?').run(noteId)
  const ins = db.prepare('INSERT INTO workspace_note_shares (note_id,user_id,can_edit,shared_at) VALUES (?,?,?,?)')
  for (const s of shares) ins.run(noteId, s.userId, s.canEdit ? 1 : 0, t)
}

export function trashNote(id: string, by: string): void {
  getDb().prepare('UPDATE workspace_notes SET deleted_at = ?, deleted_by = ? WHERE id = ?').run(now(), by, id)
}
export function restoreNote(id: string): void {
  getDb().prepare('UPDATE workspace_notes SET deleted_at = NULL, deleted_by = NULL WHERE id = ?').run(id)
}
export function purgeNote(id: string): void {
  getDb().prepare('DELETE FROM workspace_notes WHERE id = ?').run(id) // note_shares hängen per CASCADE
}
export function setArchived(id: string, archived: boolean): void {
  getDb().prepare('UPDATE workspace_notes SET archived_at = ?, updated_at = ? WHERE id = ?').run(archived ? now() : null, now(), id)
}

/** Papierkorb — nur eigene gelöschte Notizen, damit private nicht über den Umweg sichtbar werden. */
export function listTrashedNotes(actor: Actor): Note[] {
  return getDb()
    .prepare(`${BASE_SELECT} WHERE n.deleted_at IS NOT NULL AND n.owner_id = ? ORDER BY n.deleted_at DESC`)
    .all(actor.id)
    .map(toNote)
}

/** Alle Tags, die dieser Benutzer sehen darf — für die Filterleiste. */
export function listTags(actor: Actor): string[] {
  const vis = visibilityClause(actor)
  const rows = getDb()
    .prepare(`SELECT n.tags FROM workspace_notes n WHERE n.deleted_at IS NULL AND ${vis.sql}`)
    .all(...vis.params) as { tags: string | null }[]
  const set = new Set<string>()
  for (const r of rows) for (const t of parseTags(r.tags)) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b, 'de'))
}
