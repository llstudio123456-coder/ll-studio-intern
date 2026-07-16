/* ─────────────────────────  Anmeldung & Zugriffsschutz — Typen  ───────────────────────── */

export type Role = 'owner' | 'admin' | 'employee' | 'member' | 'guest' | 'viewer'
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Inhaber',
  admin: 'Administrator',
  employee: 'Mitarbeiter',
  member: 'Mitglied',
  guest: 'Gast',
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

/**
 * Rangordnung der Rollen für „mindestens"-Prüfungen.
 * Zentral definiert — jede serverseitige Prüfung leitet sich hieraus ab, nie aus sichtbaren Buttons.
 */
export const ROLE_RANK: Record<Role, number> = { viewer: 0, guest: 1, member: 2, employee: 3, admin: 4, owner: 5 }
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
  // 3) An sich selbst ist nur „überall abmelden" erlaubt. Das verbietet zugleich jede
  //    Selbst-Hochstufung: setRole auf die eigene Person ist damit strukturell ausgeschlossen,
  //    egal was ein manipulierter Request behauptet.
  if (actor.id === target.id) return action === 'revokeSessions'
  // 4) Der Handelnde muss den Zielbenutzer ECHT überragen. Gleichrang genügt nicht — sonst
  //    könnten sich zwei Administratoren gegenseitig absetzen.
  if (ROLE_RANK[actor.role] <= ROLE_RANK[target.role]) return false
  return true
}

/**
 * Rollen, die ein Handelnder vergeben darf: ausschließlich Rollen UNTERHALB der eigenen.
 * „owner" ist nie darunter — die Inhaber-Rolle steuert allein OWNER_EMAILS. Damit kann sich auch
 * ein Administrator mit gekapertem Zugang nicht zum Inhaber machen.
 */
export function assignableRoles(actor: { role: Role }): Role[] {
  if (!roleAtLeast(actor.role, 'admin')) return []
  const below = (Object.keys(ROLE_RANK) as Role[]).filter((r) => r !== 'owner' && ROLE_RANK[r] < ROLE_RANK[actor.role])
  return below.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])
}

/** Niedrigste Rolle — Standard für neu freigegebene Adressen (Prinzip der geringsten Rechte). */
export const DEFAULT_INVITE_ROLE: Role = 'guest'
