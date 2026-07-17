import { randomUUID } from 'crypto'
import { getDb } from '../kundenfinder/db'
import { publish } from './chatBus'
import { safeLink, type Notification, type NotificationKind } from '@shared/notifications'

const now = () => new Date().toISOString()

/* eslint-disable @typescript-eslint/no-explicit-any */
const toNotification = (r: any): Notification => ({
  id: r.id,
  kind: r.kind as NotificationKind,
  title: r.title,
  body: r.body || undefined,
  link: safeLink(r.link || undefined),
  actorId: r.actor_id || undefined,
  actorName: r.actor_name || undefined,
  sourceType: r.source_type || undefined,
  sourceId: r.source_id || undefined,
  readAt: r.read_at || undefined,
  createdAt: r.created_at
})
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Benachrichtigung(en) anlegen.
 *
 * Eine Zeile je Empfänger. Der Absender selbst bekommt nie eine — wer etwas auslöst, muss darüber
 * nicht informiert werden, und eine Selbstbenachrichtigung wirkt wie ein Fehler.
 */
export function notify(p: {
  userIds: string[]
  kind: NotificationKind
  title: string
  body?: string
  link?: string
  actorId?: string
  sourceType?: string
  sourceId?: string
}): void {
  const db = getDb()
  const targets = [...new Set(p.userIds)].filter((u) => u && u !== p.actorId)
  if (targets.length === 0) return

  // Nur interne Ziele. Ein Link von außen wäre eine offene Weiterleitung mit Vertrauensbonus.
  const link = safeLink(p.link) || null
  const t = now()
  const ins = db.prepare(
    'INSERT INTO workspace_notifications (id,user_id,kind,title,body,link,actor_id,source_type,source_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  )
  for (const uid of targets) {
    ins.run(randomUUID(), uid, p.kind, p.title.slice(0, 200), p.body?.slice(0, 500) || null, link, p.actorId || null, p.sourceType || null, p.sourceId || null, t)
  }

  // Über denselben Echtzeit-Strom wie der Chat — ein zweiter Kanal wäre eine zweite
  // Rechteprüfung und damit eine zweite Fehlerquelle. Gesendet wird nur an die Empfänger.
  publish(targets, { type: 'notification' })
}

export function listNotifications(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}): Notification[] {
  const where = ['n.user_id = ?']
  const params: unknown[] = [userId]
  if (opts.unreadOnly) where.push('n.read_at IS NULL')
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100)

  return getDb()
    .prepare(
      `SELECT n.*, u.name AS actor_name FROM workspace_notifications n
       LEFT JOIN app_users u ON u.id = n.actor_id
       WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC LIMIT ?`
    )
    .all(...params, limit)
    .map(toNotification)
}

export function unreadCount(userId: string): number {
  const r = getDb()
    .prepare('SELECT COUNT(*) AS n FROM workspace_notifications WHERE user_id = ? AND read_at IS NULL')
    .get(userId) as { n: number }
  return r.n
}

/** Als gelesen markieren — die user_id im WHERE verhindert das Markieren fremder Zeilen. */
export function markRead(userId: string, id: string): void {
  getDb().prepare('UPDATE workspace_notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL').run(now(), id, userId)
}

export function markAllRead(userId: string): number {
  return getDb().prepare('UPDATE workspace_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), userId).changes
}

/** Aufräumen: Gelesenes älter als 60 Tage verfällt — die Glocke ist kein Archiv. */
export function pruneOld(): number {
  const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString()
  return getDb().prepare('DELETE FROM workspace_notifications WHERE read_at IS NOT NULL AND created_at < ?').run(cutoff).changes
}
