import { guardAdmin } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { listEntries, createEntry, findByEmail } from '@/server/auth/allowlistRepo'
import { ownerEmails, isOwnerEmail } from '@/server/auth/config'
import { assignableRoles, DEFAULT_INVITE_ROLE, type Role } from '@shared/auth'
import { isValidEmail, normalizeEmail } from '@shared/allowlist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Freigegebene E-Mail-Adressen. */
export async function GET() {
  const g = await guardAdmin()
  if (!g.ok) return g.response
  const actor = g.user!

  const owners = ownerEmails().map(normalizeEmail)
  const entries = listEntries().map((e) => ({
    ...e,
    // Inhaber-Einträge sind auch hier unantastbar: Ein Widerruf wäre ein Aussperren.
    fromEnv: owners.includes(normalizeEmail(e.email)),
    isProtectedOwner: owners.includes(normalizeEmail(e.email))
  }))

  return Response.json({
    ok: true,
    entries,
    actor: { id: actor.id, role: actor.role },
    assignableRoles: assignableRoles(actor),
    defaultRole: DEFAULT_INVITE_ROLE
  })
}

interface Body {
  email?: string
  defaultRole?: Role
  firstName?: string
  lastName?: string
  notes?: string
  expiresAt?: string
  activateImmediately?: boolean
}

/** Neue Adresse freigeben. Es gibt bewusst keine öffentliche Registrierung — nur diesen Weg. */
export async function POST(req: Request) {
  const g = await guardAdmin()
  if (!g.ok) return g.response
  const actor = g.user!

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  const email = (body.email || '').trim()
  if (!isValidEmail(email)) return Response.json({ ok: false, error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, { status: 400 })

  // Gmail-Varianten („max.muster+job@") zeigen auf dasselbe Postfach — sonst entstünden Dubletten
  // und ein Widerruf ließe sich mit einer Schreibvariante umgehen.
  if (findByEmail(email)) {
    return Response.json({ ok: false, error: 'Diese Adresse ist bereits freigegeben.' }, { status: 409 })
  }

  // Niemand darf über die Liste eine Rolle vergeben, die er selbst nicht vergeben dürfte.
  // Insbesondere ist „owner" nie darunter — die Inhaber-Rolle steuert allein OWNER_EMAILS.
  const role = body.defaultRole || DEFAULT_INVITE_ROLE
  if (!assignableRoles(actor).includes(role)) {
    audit('allowlist_role_denied', { userId: actor.id, email: actor.email, success: false, meta: { requested: role } })
    return Response.json({ ok: false, error: 'Diese Rolle kannst du nicht vergeben.' }, { status: 403 })
  }
  // Zusätzlicher Riegel: Eine Inhaber-Adresse über die Liste anzulegen ergäbe einen Eintrag,
  // der so aussieht, als könne die Oberfläche Inhaber vergeben. Kann sie nicht.
  if (isOwnerEmail(email)) {
    return Response.json({ ok: false, error: 'Inhaber werden ausschließlich über OWNER_EMAILS festgelegt.' }, { status: 403 })
  }

  if (body.expiresAt && Number.isNaN(new Date(body.expiresAt).getTime())) {
    return Response.json({ ok: false, error: 'Das Ablaufdatum ist ungültig.' }, { status: 400 })
  }

  const entry = createEntry({
    email,
    defaultRole: role,
    firstName: body.firstName?.trim() || undefined,
    lastName: body.lastName?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    expiresAt: body.expiresAt || undefined,
    status: body.activateImmediately ? 'approved' : 'invited',
    invitedBy: actor.id
  })

  audit('allowlist_created', { userId: actor.id, email: actor.email, resource: entry.id, meta: { email: entry.email, role, expiresAt: entry.expiresAt } })
  return Response.json({ ok: true, entry })
}
