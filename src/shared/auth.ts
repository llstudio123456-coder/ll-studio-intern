/* ─────────────────────────  Anmeldung & Zugriffsschutz — Typen  ───────────────────────── */

export type Role = 'owner' | 'admin' | 'member' | 'viewer'
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Inhaber',
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
export const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 }
export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

/**
 * Der Inhaber ist unantastbar: nicht deaktivierbar, nicht sperrbar, nicht löschbar,
 * nicht herabstufbar — auch nicht durch einen anderen Inhaber oder ihn selbst.
 * Wer Inhaber ist, entscheidet ausschließlich OWNER_EMAILS (Env), nie die Oberfläche.
 */
export function isProtectedOwner(user: { role: Role }): boolean {
  return user.role === 'owner'
}

/** Aktionen, die ein Administrator an einem Benutzer vornehmen darf. */
export type UserAction = 'setRole' | 'activate' | 'deactivate' | 'block' | 'unblock' | 'revokeSessions' | 'delete'

/**
 * Autoritative Regel, wer was darf. Wird server- UND clientseitig genutzt — der Server
 * entscheidet, der Client blendet nur passend aus.
 *
 * @param actor  handelnder Benutzer
 * @param target betroffener Benutzer
 */
export function canActOn(actor: { id: string; role: Role }, target: { id: string; role: Role }, action: UserAction): boolean {
  // 1) Inhaber sind gegen alles geschützt. Ausnahme: Sitzungen widerrufen darf ein Inhaber bei sich selbst
  //    (Notfall: gestohlenes Gerät) — das sperrt niemanden dauerhaft aus.
  if (isProtectedOwner(target)) {
    return action === 'revokeSessions' && actor.id === target.id && actor.role === 'owner'
  }
  // 2) Ohne Admin-Rang gar nichts.
  if (!roleAtLeast(actor.role, 'admin')) return false
  // 3) An sich selbst ist nur „überall abmelden" erlaubt. Deaktivieren/Sperren/Löschen der eigenen
  //    Person wäre eine Selbstaussperrung; die Rangregel unten darf hier nicht mehr greifen,
  //    sonst könnte ein Admin nicht einmal die eigenen Sitzungen beenden.
  if (actor.id === target.id) return action === 'revokeSessions'
  // 4) Ein Admin darf nicht an Gleichrangigen schrauben; ein Inhaber darf an Admins.
  if (actor.role === 'admin' && ROLE_RANK[target.role] >= ROLE_RANK.admin) return false
  return true
}

/** Rollen, die ein Handelnder vergeben darf. „owner" ist nie darunter — das steuert nur die Env. */
export function assignableRoles(actor: { role: Role }): Role[] {
  if (actor.role === 'owner') return ['admin', 'member', 'viewer']
  if (actor.role === 'admin') return ['member', 'viewer']
  return []
}
