/* ─────────────────────────  Projekte — Typen & Regeln  ───────────────────────── */

import type { Role } from './auth'
import { roleAtLeast } from './auth'

export type ProjectKind =
  | 'website'
  | 'ueberarbeitung'
  | 'landingpage'
  | 'wartung'
  | 'vorschlag'
  | 'branding'
  | 'logo'
  | 'email'
  | 'social'
  | 'intern'
  | 'akquise'

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  website: 'Neue Website',
  ueberarbeitung: 'Website-Überarbeitung',
  landingpage: 'Landingpage',
  wartung: 'Website-Wartung',
  vorschlag: 'Website-Vorschlag',
  branding: 'Branding',
  logo: 'Logo',
  email: 'E-Mail-Design',
  social: 'Social Media',
  intern: 'Internes Projekt',
  akquise: 'Kundenakquise'
}

export type ProjectStatus =
  | 'geplant'
  | 'vorbereitung'
  | 'aktiv'
  | 'wartet_kunde'
  | 'pausiert'
  | 'pruefung'
  | 'abgeschlossen'
  | 'abgebrochen'
  | 'archiviert'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  geplant: 'Geplant',
  vorbereitung: 'Vorbereitung',
  aktiv: 'Aktiv',
  wartet_kunde: 'Wartet auf Kunde',
  pausiert: 'Pausiert',
  pruefung: 'Zur Prüfung',
  abgeschlossen: 'Abgeschlossen',
  abgebrochen: 'Abgebrochen',
  archiviert: 'Archiviert'
}

export const PROJECT_CLOSED: ProjectStatus[] = ['abgeschlossen', 'abgebrochen', 'archiviert']

export type ProjectPriority = 'niedrig' | 'normal' | 'hoch' | 'dringend'
export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
  dringend: 'Dringend'
}

/** 'private' sehen nur Projektleitung und Mitglieder — auch kein Administrator (Spez. §30-Linie). */
export type ProjectVisibility = 'private' | 'team'
export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  private: 'Nur Team-Mitglieder',
  team: 'Gesamtes Team'
}

export interface Project {
  id: string
  name: string
  description: string
  kind: ProjectKind
  status: ProjectStatus
  priority: ProjectPriority
  visibility: ProjectVisibility
  color?: string
  companyId?: string
  companyName?: string
  leadId?: string
  leadName?: string
  chatChannelId?: string
  folderId?: string
  startDate?: string
  dueDate?: string
  completedAt?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
  deletedAt?: string
  members?: { id: string; name?: string; email: string; role: string }[]
  /** Vom Server berechnet — aus Aufgabenzahlen. */
  taskCount?: number
  taskDone?: number
  progress?: number
  canEdit?: boolean
}

/**
 * Fortschritt aus erledigten Aufgaben (0–100). Ohne Aufgaben 0 — nicht „fertig".
 */
export function projectProgress(taskCount: number, taskDone: number): number {
  if (taskCount <= 0) return 0
  return Math.round((taskDone / taskCount) * 100)
}

/**
 * Lesen: Projektleitung und Mitglieder immer; Team-Projekte alle. Eine Adminrolle öffnet ein
 * privates Projekt NICHT automatisch — private Projekte sind nichts, was ein Admin nebenbei sieht.
 */
export function canReadProject(actor: { id: string; role: Role } | null, p: { leadId?: string; visibility: ProjectVisibility }, isMember: boolean): boolean {
  if (!actor) return false
  if (p.leadId === actor.id || isMember) return true
  return p.visibility === 'team'
}

/** Bearbeiten: Projektleitung und Mitglieder; bei Team-Projekten jeder Mitarbeiter. */
export function canEditProject(actor: { id: string; role: Role } | null, p: { leadId?: string; visibility: ProjectVisibility }, isMember: boolean): boolean {
  if (!actor) return false
  if (p.leadId === actor.id || isMember) return true
  if (p.visibility !== 'team') return false
  return roleAtLeast(actor.role, 'employee')
}

/** Verwalten (löschen, Mitglieder, Leitung ändern): Projektleitung, Ersteller oder Admin. */
export function canManageProject(actor: { id: string; role: Role } | null, p: { leadId?: string; createdBy?: string }): boolean {
  if (!actor) return false
  if (p.leadId === actor.id || p.createdBy === actor.id) return true
  return roleAtLeast(actor.role, 'admin')
}
