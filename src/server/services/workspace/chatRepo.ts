import { randomUUID } from 'crypto'
import { getDb } from '../kundenfinder/db'
import type { Role } from '@shared/auth'
import { ROLE_RANK } from '@shared/auth'
import type { Channel, ChannelKind, ChannelVisibility, ChatMessage } from '@shared/chat'

const now = () => new Date().toISOString()

export interface Actor {
  id: string
  role: Role
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toChannel = (r: any): Channel => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description || undefined,
  kind: r.kind as ChannelKind,
  visibility: r.visibility as ChannelVisibility,
  writeRole: (r.write_role as Role) || undefined,
  companyId: r.company_id || undefined,
  companyName: r.company_name || undefined,
  createdAt: r.created_at,
  archivedAt: r.archived_at || undefined,
  isMember: r.is_member != null ? !!r.is_member : undefined,
  unread: r.unread ?? undefined,
  lastMessageAt: r.last_message_at || undefined
})

const toMessage = (r: any): ChatMessage => ({
  id: r.id,
  channelId: r.channel_id,
  authorId: r.author_id || undefined,
  authorName: r.author_name || undefined,
  authorPicture: r.author_picture || undefined,
  body: r.deleted_at ? '' : r.body,
  replyTo: r.reply_to || undefined,
  replyToBody: r.reply_body || undefined,
  replyToAuthor: r.reply_author || undefined,
  fileId: r.file_id || undefined,
  fileName: r.file_name || undefined,
  fileMime: r.file_mime || undefined,
  pinned: !!r.pinned,
  editedAt: r.edited_at || undefined,
  createdAt: r.created_at,
  deletedAt: r.deleted_at || undefined
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export function isMember(channelId: string, userId: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM workspace_channel_members WHERE channel_id = ? AND user_id = ?').get(channelId, userId)
}

export function getChannelRaw(id: string): Channel | null {
  const r = getDb().prepare('SELECT * FROM workspace_channels WHERE id = ?').get(id)
  return r ? toChannel(r) : null
}

/**
 * Kanäle, die dieser Benutzer sehen darf — mit Ungelesen-Zähler.
 *
 * Die Sichtbarkeit filtert in SQL: Private Kanäle ohne Mitgliedschaft erscheinen nicht,
 * auch nicht als Name. Direktnachrichten sind immer geschlossen.
 */
export function listChannels(actor: Actor): Channel[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*,
              (SELECT 1 FROM workspace_channel_members m WHERE m.channel_id = c.id AND m.user_id = ?) AS is_member,
              (SELECT MAX(created_at) FROM workspace_messages WHERE channel_id = c.id AND deleted_at IS NULL) AS last_message_at,
              (SELECT COUNT(*) FROM workspace_messages ms
                WHERE ms.channel_id = c.id AND ms.deleted_at IS NULL AND ms.author_id <> ?
                  AND ms.created_at > IFNULL((SELECT last_read_at FROM workspace_channel_members m2
                                              WHERE m2.channel_id = c.id AND m2.user_id = ?), '')) AS unread
       FROM workspace_channels c
       WHERE c.archived_at IS NULL
         AND (
           EXISTS (SELECT 1 FROM workspace_channel_members m3 WHERE m3.channel_id = c.id AND m3.user_id = ?)
           OR (c.visibility = 'offen' AND c.kind <> 'dm')
         )
       ORDER BY CASE c.kind WHEN 'dm' THEN 1 ELSE 0 END, c.name COLLATE NOCASE`
    )
    .all(actor.id, actor.id, actor.id, actor.id)
    .map(toChannel)

  // Bei Direktnachrichten den Namen des Gegenübers zeigen statt der internen Bezeichnung.
  for (const c of rows) {
    if (c.kind === 'dm') {
      const other = getDb()
        .prepare(
          `SELECT u.id, u.name, u.email FROM workspace_channel_members m
           JOIN app_users u ON u.id = m.user_id
           WHERE m.channel_id = ? AND m.user_id <> ? LIMIT 1`
        )
        .get(c.id, actor.id) as { id: string; name: string | null; email: string } | undefined
      if (other) c.name = other.name || other.email
    }
  }
  return rows
}

export function channelMembers(channelId: string): { id: string; name?: string; email: string }[] {
  return getDb()
    .prepare(
      `SELECT u.id, u.name, u.email FROM workspace_channel_members m
       JOIN app_users u ON u.id = m.user_id WHERE m.channel_id = ? ORDER BY u.name COLLATE NOCASE, u.email`
    )
    .all(channelId)
    .map((r) => {
      const row = r as { id: string; name: string | null; email: string }
      return { id: row.id, name: row.name || undefined, email: row.email }
    })
}

/**
 * Empfänger eines Echtzeit-Ereignisses.
 * Bei offenen Kanälen sind das alle aktiven Benutzer, sonst nur die Mitglieder —
 * so verlässt kein Hinweis den berechtigten Kreis.
 */
export function eventRecipients(channelId: string): string[] {
  const ch = getChannelRaw(channelId)
  if (!ch) return []
  if (ch.visibility === 'offen' && ch.kind !== 'dm') {
    return getDb().prepare("SELECT id FROM app_users WHERE status = 'active'").all().map((r) => (r as { id: string }).id)
  }
  return channelMembers(channelId).map((m) => m.id)
}

export function join(channelId: string, userId: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO workspace_channel_members (channel_id,user_id,joined_at) VALUES (?,?,?)')
    .run(channelId, userId, now())
}

export function leave(channelId: string, userId: string): void {
  getDb().prepare('DELETE FROM workspace_channel_members WHERE channel_id = ? AND user_id = ?').run(channelId, userId)
}

export function markRead(channelId: string, userId: string): void {
  const db = getDb()
  // Beitreten und Lesen in einem: Wer einen offenen Kanal öffnet, wird Mitglied und behält
  // damit seinen Ungelesen-Stand.
  join(channelId, userId)
  db.prepare('UPDATE workspace_channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?').run(now(), channelId, userId)
}

const MSG_SELECT = `
  SELECT m.*, u.name AS author_name, u.picture AS author_picture,
         f.name AS file_name, f.mime AS file_mime,
         r.body AS reply_body, ru.name AS reply_author
  FROM workspace_messages m
  LEFT JOIN app_users u ON u.id = m.author_id
  LEFT JOIN files f ON f.id = m.file_id
  LEFT JOIN workspace_messages r ON r.id = m.reply_to
  LEFT JOIN app_users ru ON ru.id = r.author_id
`

export function listMessages(channelId: string, opts: { before?: string; limit?: number; query?: string } = {}): ChatMessage[] {
  const where: string[] = ['m.channel_id = ?']
  const params: unknown[] = [channelId]
  if (opts.before) { where.push('m.created_at < ?'); params.push(opts.before) }
  if (opts.query?.trim()) {
    where.push('LOWER(m.body) LIKE ?', 'm.deleted_at IS NULL')
    params.push(`%${opts.query.trim().toLowerCase()}%`)
  }
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200)
  // Neueste zuerst holen, dann drehen — so bekommt man das Ende der Unterhaltung.
  const rows = getDb()
    .prepare(`${MSG_SELECT} WHERE ${where.join(' AND ')} ORDER BY m.created_at DESC LIMIT ?`)
    .all(...params, limit)
    .map(toMessage)
  return rows.reverse()
}

export function getMessage(id: string): ChatMessage | null {
  const r = getDb().prepare(`${MSG_SELECT} WHERE m.id = ?`).get(id)
  return r ? toMessage(r) : null
}

export function pinnedMessages(channelId: string): ChatMessage[] {
  return getDb()
    .prepare(`${MSG_SELECT} WHERE m.channel_id = ? AND m.pinned = 1 AND m.deleted_at IS NULL ORDER BY m.created_at DESC`)
    .all(channelId)
    .map(toMessage)
}

export function createMessage(p: {
  channelId: string
  authorId: string
  body: string
  replyTo?: string | null
  fileId?: string | null
  mentions?: string[]
}): ChatMessage {
  const db = getDb()
  const id = randomUUID()
  db.prepare('INSERT INTO workspace_messages (id,channel_id,author_id,body,reply_to,file_id,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, p.channelId, p.authorId, p.body.trim(), p.replyTo || null, p.fileId || null, now())
  if (p.mentions?.length) {
    const ins = db.prepare('INSERT OR IGNORE INTO workspace_message_mentions (message_id,user_id) VALUES (?,?)')
    for (const u of p.mentions) ins.run(id, u)
  }
  // Wer schreibt, ist Mitglied und hat das Geschriebene gelesen.
  markRead(p.channelId, p.authorId)
  return getMessage(id)!
}

export function updateMessage(id: string, body: string): ChatMessage | null {
  getDb().prepare('UPDATE workspace_messages SET body = ?, edited_at = ? WHERE id = ?').run(body.trim(), now(), id)
  return getMessage(id)
}

/**
 * Nachricht löschen.
 * Der Text wird geleert, die Zeile bleibt — sonst zerfielen Antwortketten, und das Audit-Log
 * verlöre den Bezug (Spezifikation §11).
 */
export function deleteMessage(id: string): void {
  getDb().prepare("UPDATE workspace_messages SET deleted_at = ?, body = '' WHERE id = ?").run(now(), id)
}

export function setPinned(id: string, pinned: boolean): void {
  getDb().prepare('UPDATE workspace_messages SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id)
}

export function createChannel(p: {
  name: string
  description?: string
  kind?: ChannelKind
  visibility?: ChannelVisibility
  writeRole?: Role | null
  companyId?: string | null
  createdBy: string
}): Channel {
  const db = getDb()
  const id = randomUUID()
  const base = p.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kanal'
  // Kürzel eindeutig machen, statt am UNIQUE-Index zu scheitern.
  let slug = base
  let n = 1
  while (db.prepare('SELECT 1 FROM workspace_channels WHERE slug = ? AND archived_at IS NULL').get(slug)) slug = `${base}-${++n}`

  db.prepare(
    'INSERT INTO workspace_channels (id,slug,name,description,kind,visibility,write_role,company_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, slug, p.name.trim(), p.description || null, p.kind || 'kanal', p.visibility || 'offen', p.writeRole || null, p.companyId || null, p.createdBy, now())
  join(id, p.createdBy)
  return getChannelRaw(id)!
}

/**
 * Direktkanal zwischen zwei Personen finden oder anlegen.
 * Idempotent: Zweimaliges Anklicken derselben Person darf keinen zweiten Chat erzeugen.
 */
export function findOrCreateDm(a: string, b: string): Channel {
  const db = getDb()
  const existing = db
    .prepare(
      `SELECT c.* FROM workspace_channels c
       WHERE c.kind = 'dm' AND c.archived_at IS NULL
         AND EXISTS (SELECT 1 FROM workspace_channel_members m WHERE m.channel_id = c.id AND m.user_id = ?)
         AND EXISTS (SELECT 1 FROM workspace_channel_members m WHERE m.channel_id = c.id AND m.user_id = ?)
         AND (SELECT COUNT(*) FROM workspace_channel_members m WHERE m.channel_id = c.id) = 2
       LIMIT 1`
    )
    .get(a, b)
  if (existing) return toChannel(existing)

  const id = randomUUID()
  db.prepare(
    "INSERT INTO workspace_channels (id,slug,name,kind,visibility,created_by,created_at) VALUES (?,?,?,'dm','privat',?,?)"
  ).run(id, `dm-${id.slice(0, 8)}`, 'Direktnachricht', a, now())
  join(id, a)
  join(id, b)
  return getChannelRaw(id)!
}

export function archiveChannel(id: string, archived: boolean): void {
  getDb().prepare('UPDATE workspace_channels SET archived_at = ? WHERE id = ?').run(archived ? now() : null, id)
}

/** Gesamtzahl ungelesener Nachrichten — für den Zähler in der Navigation. */
export function totalUnread(actor: Actor): number {
  return listChannels(actor).reduce((n, c) => n + (c.unread || 0), 0)
}

export function activeUsers(): { id: string; name?: string; email: string; picture?: string }[] {
  return getDb()
    .prepare("SELECT id, name, email, picture FROM app_users WHERE status = 'active' ORDER BY name COLLATE NOCASE, email")
    .all()
    .map((r) => {
      const row = r as { id: string; name: string | null; email: string; picture: string | null }
      return { id: row.id, name: row.name || undefined, email: row.email, picture: row.picture || undefined }
    })
}

/** Rangprüfung für Schreibrollen — Rangordnung ausschließlich aus @shared/auth. */
export function meetsWriteRole(actorRole: Role, required?: Role): boolean {
  if (!required) return true
  return ROLE_RANK[actorRole] >= ROLE_RANK[required]
}
