import { guardAdmin } from '@/server/auth/guard'
import { getUserById, setUserRole, setUserStatus, bumpTokenVersion, deleteUser, audit } from '@/server/auth/repo'
import { canActOn, assignableRoles, type Role, type UserAction } from '@shared/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  action?: UserAction
  role?: Role
}

/**
 * Sensible Benutzeraktionen. Verlangt über guardAdmin: Session → aktiver Benutzer →
 * Gate → Admin-Rang → frische Admin-Bestätigung.
 *
 * Die Rolle des Handelnden wird AUS DER DATENBANK gelesen, nie aus dem Request. Eine im Browser
 * manipulierte Rollenangabe hat deshalb keinerlei Wirkung.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin()
  if (!g.ok) return g.response
  const actor = g.user!

  const { id } = await ctx.params
  const target = getUserById(id)
  if (!target) return Response.json({ ok: false, error: 'Benutzer nicht gefunden.' }, { status: 404 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }
  const action = body.action
  if (!action) return Response.json({ ok: false, error: 'Keine Aktion angegeben.' }, { status: 400 })

  // Die eine autoritative Regel — dieselbe, die auch die Oberfläche benutzt.
  if (!canActOn(actor, target, action)) {
    audit('admin_action_denied', { userId: actor.id, email: actor.email, resource: target.id, success: false, meta: { action, targetRole: target.role } })
    const why = target.role === 'owner'
      ? 'Der Inhaber ist geschützt und kann nicht verändert werden.'
      : 'Für diese Aktion fehlt die Berechtigung.'
    return Response.json({ ok: false, error: why }, { status: 403 })
  }

  try {
    switch (action) {
      case 'setRole': {
        const role = body.role
        if (!role || !assignableRoles(actor).includes(role)) {
          return Response.json({ ok: false, error: 'Diese Rolle kann nicht vergeben werden.' }, { status: 400 })
        }
        setUserRole(target.id, role)
        // Rollenwechsel entwertet bestehende Sitzungen: Die alte Rolle steckt im JWT.
        bumpTokenVersion(target.id)
        break
      }
      case 'activate':
        setUserStatus(target.id, 'active', actor.id)
        break
      case 'deactivate':
        // setUserStatus widerruft bei inaktiven Status automatisch alle Sitzungen (bumpTokenVersion),
        // die Sperre greift dadurch sofort und nicht erst beim nächsten Seitenaufruf.
        setUserStatus(target.id, 'deactivated', actor.id)
        break
      case 'block':
        setUserStatus(target.id, 'blocked', actor.id)
        break
      case 'unblock':
        setUserStatus(target.id, 'active', actor.id)
        break
      case 'revokeSessions':
        bumpTokenVersion(target.id)
        break
      case 'delete':
        deleteUser(target.id)
        break
      default:
        return Response.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
    }
  } catch (e) {
    // z. B. die Inhaber-Sperre in der Datenschicht. Interna bleiben draußen.
    audit('admin_action_error', { userId: actor.id, email: actor.email, resource: target.id, success: false, meta: { action, message: String(e) } })
    return Response.json({ ok: false, error: 'Die Aktion konnte nicht ausgeführt werden.' }, { status: 409 })
  }

  audit('admin_action', { userId: actor.id, email: actor.email, resource: target.id, meta: { action, targetEmail: target.email, role: body.role } })
  return Response.json({ ok: true, user: getUserById(target.id) })
}
