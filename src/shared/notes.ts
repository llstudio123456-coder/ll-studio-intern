/* ─────────────────────────  Notizen — Typen & Regeln  ───────────────────────── */

import type { Role } from './auth'
import { roleAtLeast } from './auth'

export type NoteKind =
  | 'persoenlich'
  | 'team'
  | 'kunde'
  | 'projekt'
  | 'besprechung'
  | 'gespraech'
  | 'telefon'
  | 'idee'
  | 'erinnerung'
  | 'checkliste'

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  persoenlich: 'Persönliche Notiz',
  team: 'Team-Notiz',
  kunde: 'Kundennotiz',
  projekt: 'Projektnotiz',
  besprechung: 'Besprechungsnotiz',
  gespraech: 'Gesprächsnotiz',
  telefon: 'Telefonnotiz',
  idee: 'Idee',
  erinnerung: 'Erinnerung',
  checkliste: 'Checkliste'
}

/**
 * Wer eine Notiz lesen darf.
 * `private` heißt wirklich privat — auch Administratoren und der Inhaber sehen sie nicht.
 */
export type NoteVisibility = 'private' | 'shared' | 'company' | 'admins' | 'owner'

export const NOTE_VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  private: 'Nur für mich',
  shared: 'Ausgewählte Personen',
  company: 'Gesamtes Unternehmen',
  admins: 'Nur Administratoren',
  owner: 'Nur Inhaber'
}

export const NOTE_VISIBILITY_HINTS: Record<NoteVisibility, string> = {
  private: 'Niemand sonst kann diese Notiz öffnen — auch kein Administrator.',
  shared: 'Nur die von dir ausgewählten Personen sehen diese Notiz.',
  company: 'Alle freigeschalteten Mitarbeiter können diese Notiz lesen.',
  admins: 'Nur Administratoren und der Inhaber sehen diese Notiz.',
  owner: 'Nur der Inhaber sieht diese Notiz.'
}

export interface Note {
  id: string
  kind: NoteKind
  title?: string
  body: string
  visibility: NoteVisibility
  ownerId?: string
  ownerName?: string
  companyId?: string
  companyName?: string
  tags: string[]
  color?: string
  pinned: boolean
  favorite: boolean
  archivedAt?: string
  remindAt?: string
  createdAt: string
  updatedAt: string
  updatedBy?: string
  deletedAt?: string
  /** Vom Server berechnet — die Oberfläche bietet nur an, was der Server auch erlaubt. */
  canEdit?: boolean
  sharedWith?: { userId: string; name?: string; canEdit: boolean }[]
}

export interface NoteShare {
  userId: string
  canEdit: boolean
}

/**
 * Autoritative Leseregel. Wird server- UND clientseitig genutzt; der Server entscheidet.
 *
 * Kernpunkt: Bei `private` gewinnt der Besitzer — keine Rolle hebelt das aus. Ein Administrator
 * ist kein Aufseher über persönliche Notizen.
 */
export function canReadNote(
  actor: { id: string; role: Role } | null,
  note: { ownerId?: string; visibility: NoteVisibility },
  sharedUserIds: string[] = []
): boolean {
  if (!actor) return false
  if (note.ownerId && note.ownerId === actor.id) return true
  switch (note.visibility) {
    case 'private':
      return false // Nur der Besitzer, und der ist oben schon durch.
    case 'shared':
      return sharedUserIds.includes(actor.id)
    case 'company':
      return true // Jeder freigeschaltete Benutzer; die Anmeldung hat bereits gefiltert.
    case 'admins':
      return roleAtLeast(actor.role, 'admin')
    case 'owner':
      return actor.role === 'owner'
    default:
      return false // Unbekannte Sichtbarkeit → Default-Deny.
  }
}

/** Schreibrecht: Besitzer immer, sonst nur bei ausdrücklicher Freigabe mit can_edit. */
export function canEditNote(
  actor: { id: string; role: Role } | null,
  note: { ownerId?: string; visibility: NoteVisibility },
  shares: NoteShare[] = []
): boolean {
  if (!actor) return false
  if (note.ownerId && note.ownerId === actor.id) return true
  if (note.visibility === 'shared') return shares.some((s) => s.userId === actor.id && s.canEdit)
  return false
}

/**
 * Löschen: nur der Besitzer. Bewusst NICHT für Administratoren — sonst könnte ein Admin
 * fremde persönliche Notizen entfernen, ohne sie je gesehen zu haben.
 */
export function canDeleteNote(actor: { id: string; role: Role } | null, note: { ownerId?: string }): boolean {
  if (!actor) return false
  return !!note.ownerId && note.ownerId === actor.id
}

/** Sichtbarkeiten, die dieser Benutzer vergeben darf. */
export function assignableVisibilities(actor: { role: Role }): NoteVisibility[] {
  const base: NoteVisibility[] = ['private', 'shared', 'company']
  if (roleAtLeast(actor.role, 'admin')) base.push('admins')
  if (actor.role === 'owner') base.push('owner')
  return base
}

/** Kurzer Textausschnitt für Listen — ohne die ganze Notiz zu laden. */
export function excerpt(body: string, max = 140): string {
  const flat = (body || '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max).trimEnd() + ' …' : flat
}
