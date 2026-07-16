import { guardAdmin } from '@/server/auth/guard'
import { audit, getUserByEmail, setUserStatus, bumpTokenVersion } from '@/server/auth/repo'
import { getEntry, setStatus, setDefaultRole, deleteEntry } from '@/server/auth/allowlistRepo'
import { isOwnerEmail } from '@/server/auth/config'
import { assignableRoles, ROLE_RANK, type Role } from '@shared/auth'
import type { AllowAction, AllowStatus } from '@shared/allowlist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  action?: AllowAction
  role?: Role
  reason?: string
}

const STATUS_FOR: Partial<Record<AllowAction, AllowStatus>> = {
  approve: 'approved',
  suspend: 'suspended',
  reactivate: 'active',
  disable: 'disabled',
  revoke: 'revoked'
}

/**
 * Aktionen an einem Freigabeeintrag.
 *
 * Der Kern: Entzieht ein Administrator die Freigabe, muss der Zugriff SOFORT weg sein — nicht erst
 * beim nächsten Seitenaufruf. Deshalb wird zusätzlich der zugehörige Benutzer deaktiviert und seine
 * Token-Version erhöht, was jede offene Sitzung augenblicklich entwertet.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin()
  if (!g.ok) return g.response
  const actor = g.user!

  const { id } = await ctx.params
  const entry = getEntry(id)
  if (!entry) return Response.json({ ok: false, error: 'Der Eintrag wurde nicht gefunden.' }, { status: 404 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }
  const action = body.action
  if (!action) return Response.json({ ok: false, error: 'Keine Aktion angegeben.' }, { status: 400 })

  // Inhaber-Adressen sind gegen alles geschützt — ein Widerruf wäre ein Aussperren des Inhabers.
  if (isOwnerEmail(entry.email)) {
    audit('allowlist_owner_denied', { userId: actor.id, email: actor.email, resource: entry.id, success: false, meta: { action } })
    return Response.json({ ok: false, error: 'Die Freigabe des Inhabers kann nicht verändert werden.' }, { status: 403 })
  }

  // Die eigene Freigabe darf niemand anfassen: weder widerrufen (Selbstaussperrung) noch die
  // eigene Rolle darüber anheben (Selbst-Hochstufung über die Hintertür).
  if (entry.email.trim().toLowerCase() === actor.email.trim().toLowerCase()) {
    return Response.json({ ok: false, error: 'Die eigene Freigabe kann nicht verändert werden.' }, { status: 403 })
  }

  const linked = getUserByEmail(entry.email)
  // Ist unter dieser Adresse schon jemand angemeldet, gilt die Rangordnung wie in der
  // Benutzerverwaltung: Nur an echt niedrigeren Rollen darf geschraubt werden.
  if (linked && !canOutrank(actor.role, linked.role)) {
    audit('allowlist_rank_denied', { userId: actor.id, email: actor.email, resource: entry.id, success: false, meta: { action, targetRole: linked.role } })
    return Response.json({ ok: false, error: 'Für diesen Benutzer fehlt die Berechtigung.' }, { status: 403 })
  }

  if (action === 'setRole') {
    const role = body.role
    if (!role || !assignableRoles(actor).includes(role)) {
      return Response.json({ ok: false, error: 'Diese Rolle kannst du nicht vergeben.' }, { status: 403 })
    }
    setDefaultRole(id, role)
    audit('allowlist_role_changed', { userId: actor.id, email: actor.email, resource: id, meta: { email: entry.email, from: entry.defaultRole, to: role, reason: body.reason } })
    return Response.json({ ok: true, entry: getEntry(id) })
  }

  if (action === 'delete') {
    deleteEntry(id)
    audit('allowlist_deleted', { userId: actor.id, email: actor.email, resource: id, meta: { email: entry.email, reason: body.reason } })
    return Response.json({ ok: true })
  }

  const status = STATUS_FOR[action]
  if (!status) return Response.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
  setStatus(id, status, actor.id)

  // Sofortwirkung auf einen bereits angemeldeten Benutzer.
  if (linked) {
    if (status === 'revoked' || status === 'disabled') {
      // Daten bleiben erhalten — nur der Zugriff endet.
      setUserStatus(linked.id, status === 'revoked' ? 'revoked' : 'deactivated', actor.id)
    } else if (status === 'suspended') {
      setUserStatus(linked.id, 'blocked', actor.id)
    } else if (status === 'active' || status === 'approved') {
      setUserStatus(linked.id, 'active', actor.id)
      // Nach der Reaktivierung muss neu angemeldet werden; alte Sitzungen bleiben ungültig.
      bumpTokenVersion(linked.id)
    }
  }

  audit(`allowlist_${action}`, { userId: actor.id, email: actor.email, resource: id, meta: { email: entry.email, from: entry.status, to: status, reason: body.reason } })
  return Response.json({ ok: true, entry: getEntry(id) })
}

/** Echt höher — Gleichrang genügt nicht. Rangordnung ausschließlich aus @shared/auth. */
function canOutrank(actorRole: Role, targetRole: Role): boolean {
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole]
}
