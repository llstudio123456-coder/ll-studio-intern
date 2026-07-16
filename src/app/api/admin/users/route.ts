import { guardAdmin } from '@/server/auth/guard'
import { listUsers } from '@/server/auth/repo'
import { ownerEmails } from '@/server/auth/config'
import { assignableRoles, canActOn, type UserAction } from '@shared/auth'
import type { AdminUserRow } from '@shared/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS: UserAction[] = ['setRole', 'activate', 'deactivate', 'block', 'unblock', 'revokeSessions', 'delete']

/**
 * Benutzerliste für den Adminbereich.
 *
 * Enthält bewusst KEIN Passwortfeld und keinen Hash — es gibt bei Google-Login gar kein lokales
 * Passwort, und ein Hash gehört auch nicht in eine API-Antwort. Stattdessen wird die Login-Methode
 * ausgewiesen. Zu jedem Benutzer liefert der Server gleich mit, welche Aktionen der Aufrufer an ihm
 * ausführen darf, damit die Oberfläche nichts anbietet, was der Server danach ablehnt.
 */
export async function GET() {
  const g = await guardAdmin()
  if (!g.ok) return g.response
  const actor = g.user!

  const owners = ownerEmails()
  const rows: AdminUserRow[] = listUsers().map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified,
    loginMethod: u.googleSub ? 'google' : 'none',
    // Bei Google-Login existiert kein lokales Passwort. Kein Hash, kein Klartext, nichts.
    passwordState: 'google',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    lastActivityAt: u.lastActivityAt,
    approvedBy: u.approvedBy,
    isProtectedOwner: u.role === 'owner',
    isSelf: u.id === actor.id,
    allowedActions: ACTIONS.filter((a) => canActOn(actor, u, a))
  }))

  return Response.json({
    ok: true,
    users: rows,
    actor: { id: actor.id, role: actor.role },
    assignableRoles: assignableRoles(actor),
    // Nur zur Erklärung in der Oberfläche („Inhaber wird über die Umgebung gesetzt“).
    ownerConfigured: owners.length > 0
  })
}
