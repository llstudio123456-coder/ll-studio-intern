/* ─────────────────────────  Team-Chat — Typen & Regeln  ───────────────────────── */

import type { Role } from './auth'
import { roleAtLeast } from './auth'

export type ChannelKind = 'kanal' | 'dm' | 'projekt' | 'kunde'

export const CHANNEL_KIND_LABELS: Record<ChannelKind, string> = {
  kanal: 'Kanal',
  dm: 'Direktnachricht',
  projekt: 'Projekt',
  kunde: 'Kunde'
}

/**
 * `offen`: Jeder freigeschaltete Mitarbeiter darf mitlesen und beitreten.
 * `privat`: Nur Mitglieder — auch über die direkte URL sieht sonst niemand etwas.
 */
export type ChannelVisibility = 'offen' | 'privat'

export interface Channel {
  id: string
  slug: string
  name: string
  description?: string
  kind: ChannelKind
  visibility: ChannelVisibility
  /** Wenn gesetzt: Nur ab dieser Rolle darf geschrieben werden (Ankündigungskanal). */
  writeRole?: Role
  companyId?: string
  companyName?: string
  createdAt: string
  archivedAt?: string
  /** Vom Server berechnet. */
  isMember?: boolean
  canWrite?: boolean
  unread?: number
  members?: { id: string; name?: string; email: string }[]
  lastMessageAt?: string
}

export interface ChatMessage {
  id: string
  channelId: string
  authorId?: string
  authorName?: string
  authorPicture?: string
  body: string
  replyTo?: string
  replyToBody?: string
  replyToAuthor?: string
  fileId?: string
  fileName?: string
  fileMime?: string
  pinned: boolean
  editedAt?: string
  createdAt: string
  deletedAt?: string
  mentions?: string[]
  /** Vom Server berechnet. */
  canEdit?: boolean
}

/**
 * Darf dieser Benutzer den Kanal lesen?
 *
 * Mitgliedschaft schlägt alles: Wer Mitglied ist, liest. Sonst nur offene Kanäle.
 * Eine Adminrolle öffnet KEINE privaten Kanäle — ein Direktchat zwischen zwei Kollegen
 * ist nichts, was ein Administrator nebenbei mitliest.
 */
export function canReadChannel(
  actor: { id: string; role: Role } | null,
  ch: { visibility: ChannelVisibility; kind: ChannelKind },
  isMember: boolean
): boolean {
  if (!actor) return false
  if (isMember) return true
  // Direktnachrichten sind immer geschlossen, auch wenn sie fälschlich als „offen" markiert wären.
  if (ch.kind === 'dm') return false
  return ch.visibility === 'offen'
}

/**
 * Darf dieser Benutzer in den Kanal schreiben?
 * Lesen genügt nicht: Der Ankündigungskanal ist für Mitarbeiter bewusst nur lesbar.
 */
export function canWriteChannel(
  actor: { id: string; role: Role } | null,
  ch: { visibility: ChannelVisibility; kind: ChannelKind; writeRole?: Role; archivedAt?: string },
  isMember: boolean
): boolean {
  if (!actor) return false
  if (ch.archivedAt) return false // Archivierte Kanäle sind Nur-Lesen.
  if (!canReadChannel(actor, ch, isMember)) return false
  if (ch.writeRole) return roleAtLeast(actor.role, ch.writeRole)
  // Gast und Viewer dürfen mitlesen, aber nicht schreiben.
  return roleAtLeast(actor.role, 'member')
}

/** Bearbeiten und Löschen: nur eigene Nachrichten. */
export function canEditMessage(actor: { id: string } | null, m: { authorId?: string }): boolean {
  if (!actor) return false
  return !!m.authorId && m.authorId === actor.id
}

/** Anheften und Moderieren: ab Administrator, oder der Verfasser selbst. */
export function canPinMessage(actor: { id: string; role: Role } | null, m: { authorId?: string }): boolean {
  if (!actor) return false
  return roleAtLeast(actor.role, 'admin') || m.authorId === actor.id
}

/** @-Erwähnungen aus einem Nachrichtentext lesen. */
export function parseMentions(body: string, users: { id: string; name?: string; email: string }[]): string[] {
  const hits = new Set<string>()
  for (const u of users) {
    const handle = (u.name || u.email.split('@')[0]).trim()
    if (!handle) continue
    // Wortgrenze davor, damit „@max" nicht in „mail@maxmuster.de" trifft.
    const re = new RegExp('(^|\\s)@' + handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (re.test(body)) hits.add(u.id)
  }
  return [...hits]
}

/** Kurzfassung für Antwort-Vorschauen und Umwandlungen. */
export function messageExcerpt(body: string, max = 100): string {
  const flat = (body || '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max).trimEnd() + ' …' : flat
}
