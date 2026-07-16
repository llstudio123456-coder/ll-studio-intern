/* ─────────────────────────  Anmeldung & Zugriffsschutz — Typen  ───────────────────────── */

export type Role = 'admin' | 'member' | 'viewer'
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  member: 'Mitarbeiter',
  viewer: 'Nur Lesen'
}

export type UserStatus = 'invited' | 'active' | 'blocked' | 'deactivated' | 'revoked'
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  invited: 'Eingeladen',
  active: 'Aktiv',
  blocked: 'Gesperrt',
  deactivated: 'Deaktiviert',
  revoked: 'Zugriff widerrufen'
}
/** Status, bei denen keine Anmeldung / kein Zugriff mehr möglich ist. */
export const INACTIVE_STATUSES: UserStatus[] = ['blocked', 'deactivated', 'revoked']

export interface AppUser {
  id: string
  googleSub?: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
  role: Role
  status: UserStatus
  tokenVersion: number
  createdAt: string
  lastLoginAt?: string
  lastActivityAt?: string
  approvedBy?: string
  approvedAt?: string
}

/** Rangordnung der Rollen für „mindestens"-Prüfungen. */
export const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2 }
export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[min]
}
