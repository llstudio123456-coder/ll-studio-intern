/* ─────────────────────────  Aufgaben — Typen & Regeln  ───────────────────────── */

import type { Role } from './auth'
import { roleAtLeast } from './auth'

export type TaskKind =
  | 'persoenlich'
  | 'team'
  | 'projekt'
  | 'kunde'
  | 'vertrieb'
  | 'design'
  | 'entwicklung'
  | 'verwaltung'

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  persoenlich: 'Persönlich',
  team: 'Team',
  projekt: 'Projekt',
  kunde: 'Kunde',
  vertrieb: 'Vertrieb',
  design: 'Design',
  entwicklung: 'Entwicklung',
  verwaltung: 'Verwaltung'
}

export type TaskStatus =
  | 'offen'
  | 'geplant'
  | 'in_bearbeitung'
  | 'wartet'
  | 'blockiert'
  | 'pruefung'
  | 'erledigt'
  | 'abgebrochen'
  | 'archiviert'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  offen: 'Offen',
  geplant: 'Geplant',
  in_bearbeitung: 'In Bearbeitung',
  wartet: 'Wartet auf Rückmeldung',
  blockiert: 'Blockiert',
  pruefung: 'Zur Prüfung',
  erledigt: 'Erledigt',
  abgebrochen: 'Abgebrochen',
  archiviert: 'Archiviert'
}

/** Spalten der Kanban-Ansicht. Bewusst weniger als alle Status — sonst wird das Brett unlesbar. */
export const KANBAN_COLUMNS: TaskStatus[] = ['offen', 'in_bearbeitung', 'wartet', 'pruefung', 'erledigt']

/** Status, bei denen die Aufgabe nicht mehr aktiv ist. */
export const CLOSED_STATUSES: TaskStatus[] = ['erledigt', 'abgebrochen', 'archiviert']

export type TaskPriority = 'niedrig' | 'normal' | 'hoch' | 'dringend'

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
  dringend: 'Dringend'
}

export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = { niedrig: 0, normal: 1, hoch: 2, dringend: 3 }

export type Recurrence = 'taeglich' | 'woechentlich' | 'zweiwoechentlich' | 'monatlich' | 'jaehrlich'

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  taeglich: 'Täglich',
  woechentlich: 'Wöchentlich',
  zweiwoechentlich: 'Alle zwei Wochen',
  monatlich: 'Monatlich',
  jaehrlich: 'Jährlich'
}

/** 'private' sehen nur Ersteller und Zuständiger — auch kein Administrator (Spez. §30). */
export type TaskVisibility = 'private' | 'team'

export const TASK_VISIBILITY_LABELS: Record<TaskVisibility, string> = {
  private: 'Nur Ersteller & Zuständiger',
  team: 'Gesamtes Team'
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
  position: number
}

export interface Task {
  id: string
  title: string
  description: string
  kind: TaskKind
  status: TaskStatus
  priority: TaskPriority
  visibility: TaskVisibility
  creatorId?: string
  creatorName?: string
  assigneeId?: string
  assigneeName?: string
  companyId?: string
  companyName?: string
  parentId?: string
  startDate?: string
  dueDate?: string
  dueTime?: string
  estimateMinutes?: number
  tags: string[]
  recurrence?: Recurrence
  remindAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  checklist?: ChecklistItem[]
  subtaskCount?: number
  subtasksDone?: number
  /** Vom Server berechnet. */
  canEdit?: boolean
}

/**
 * Autoritative Leseregel.
 *
 * Bei 'private' zählen ausschließlich Ersteller und Zuständiger. Eine Adminrolle hebelt das
 * nicht aus — persönliche Aufgaben sind kein Kontrollinstrument.
 */
export function canReadTask(actor: { id: string; role: Role } | null, t: { creatorId?: string; assigneeId?: string; visibility: TaskVisibility }): boolean {
  if (!actor) return false
  if (t.creatorId === actor.id || t.assigneeId === actor.id) return true
  return t.visibility === 'team'
}

/** Bearbeiten: Ersteller und Zuständiger immer; bei Team-Aufgaben jeder Mitarbeiter. */
export function canEditTask(actor: { id: string; role: Role } | null, t: { creatorId?: string; assigneeId?: string; visibility: TaskVisibility }): boolean {
  if (!actor) return false
  if (t.creatorId === actor.id || t.assigneeId === actor.id) return true
  if (t.visibility !== 'team') return false
  return roleAtLeast(actor.role, 'employee')
}

/** Löschen: nur der Ersteller. Auch ein Administrator entfernt keine fremde private Aufgabe. */
export function canDeleteTask(actor: { id: string; role: Role } | null, t: { creatorId?: string }): boolean {
  if (!actor) return false
  return !!t.creatorId && t.creatorId === actor.id
}

/** Ist die Aufgabe überfällig? Erledigte sind nie überfällig. */
export function isOverdue(t: { dueDate?: string; status: TaskStatus }): boolean {
  if (!t.dueDate || CLOSED_STATUSES.includes(t.status)) return false
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  return new Date(t.dueDate) < heute
}

export function isDueToday(t: { dueDate?: string; status: TaskStatus }): boolean {
  if (!t.dueDate || CLOSED_STATUSES.includes(t.status)) return false
  return new Date(t.dueDate).toDateString() === new Date().toDateString()
}

/**
 * Nächster Termin einer wiederkehrenden Aufgabe.
 *
 * Rechnet ab dem bisherigen Fälligkeitsdatum, nicht ab „heute" — sonst verschiebt sich ein
 * wöchentlicher Termin bei verspätetem Abhaken dauerhaft nach hinten.
 *
 * Durchgehend in UTC: Ein Datum wie „2026-03-10" wird als UTC-Mitternacht gelesen. Mit den
 * lokalen Settern (setMonth/getMonth) fällt das Ergebnis über die Sommerzeitgrenze um eine
 * Stunde zurück und verliert beim Zurückrechnen nach UTC einen ganzen Tag — eine monatliche
 * Aufgabe wanderte so jedes Frühjahr nach vorne. Die UTC-Setter kennen keine Zeitumstellung.
 */
export function nextDueDate(from: string, r: Recurrence): string {
  const d = new Date(from)
  if (Number.isNaN(d.getTime())) return from
  switch (r) {
    case 'taeglich': d.setUTCDate(d.getUTCDate() + 1); break
    case 'woechentlich': d.setUTCDate(d.getUTCDate() + 7); break
    case 'zweiwoechentlich': d.setUTCDate(d.getUTCDate() + 14); break
    case 'monatlich': d.setUTCMonth(d.getUTCMonth() + 1); break
    case 'jaehrlich': d.setUTCFullYear(d.getUTCFullYear() + 1); break
  }
  return d.toISOString().slice(0, 10)
}
