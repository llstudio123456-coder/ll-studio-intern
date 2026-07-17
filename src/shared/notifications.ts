/* ─────────────────────────  Benachrichtigungen — Typen & Regeln  ───────────────────────── */

export type NotificationKind =
  | 'mention'
  | 'dm'
  | 'task_assigned'
  | 'task_due'
  | 'note_shared'
  | 'announcement'
  | 'channel_added'

export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  mention: 'Erwähnung',
  dm: 'Direktnachricht',
  task_assigned: 'Aufgabe zugewiesen',
  task_due: 'Aufgabe fällig',
  note_shared: 'Notiz geteilt',
  announcement: 'Ankündigung',
  channel_added: 'Zu Kanal hinzugefügt'
}

export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  body?: string
  link?: string
  actorId?: string
  actorName?: string
  sourceType?: string
  sourceId?: string
  readAt?: string
  createdAt: string
}

/**
 * Nur interne Ziele zulassen.
 *
 * Eine Benachrichtigung darf niemals nach außen führen: Ein Link, der aus Benutzertext oder einer
 * manipulierten Anfrage stammt, wäre sonst eine offene Weiterleitung — und zwar eine, der man
 * besonders bereitwillig folgt, weil sie aus dem eigenen Werkzeug kommt.
 */
export function safeLink(link?: string): string | undefined {
  if (!link) return undefined
  if (!link.startsWith('/')) return undefined
  if (link.startsWith('//')) return undefined // protokollrelative URL → fremder Host
  if (link.includes('\\')) return undefined
  return link
}

/** Menschlich lesbarer Zeitabstand. */
export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'gerade eben'
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`
  const d = Math.floor(s / 86400)
  if (d === 1) return 'gestern'
  if (d < 7) return `vor ${d} Tagen`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
