import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { listChannels, createChannel, findOrCreateDm, activeUsers, type Actor } from '@/server/services/workspace/chatRepo'
import { roleAtLeast, type Role } from '@shared/auth'
import type { ChannelVisibility } from '@shared/chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })

/** Sichtbare Kanäle inklusive Ungelesen-Zähler. Private ohne Mitgliedschaft erscheinen nicht. */
export async function GET() {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  return Response.json({
    success: true,
    ok: true,
    channels: listChannels(actor),
    users: activeUsers(),
    me: { id: actor.id, role: actor.role }
  })
}

interface Body {
  action?: 'create' | 'dm'
  name?: string
  description?: string
  visibility?: ChannelVisibility
  userId?: string
}

export async function POST(req: Request) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  // Direktnachricht: darf jeder Mitarbeiter mit jedem aktiven Kollegen beginnen.
  if (body.action === 'dm') {
    const other = (body.userId || '').trim()
    if (!other || other === actor.id) {
      return Response.json({ success: false, ok: false, error: 'Bitte eine andere Person auswählen.' }, { status: 400 })
    }
    if (!activeUsers().some((u) => u.id === other)) {
      return Response.json({ success: false, ok: false, error: 'Diese Person ist nicht verfügbar.' }, { status: 404 })
    }
    return Response.json({ success: true, ok: true, channel: findOrCreateDm(actor.id, other) })
  }

  // Neue Kanäle legt nur ein Administrator an (Spezifikation §11).
  if (!roleAtLeast(actor.role, 'admin')) {
    return Response.json({ success: false, ok: false, error: 'Kanäle dürfen nur Administratoren anlegen.' }, { status: 403 })
  }
  const name = (body.name || '').trim()
  if (!name) return Response.json({ success: false, ok: false, error: 'Der Kanal braucht einen Namen.' }, { status: 400 })

  const channel = createChannel({
    name,
    description: body.description?.trim() || undefined,
    visibility: body.visibility || 'offen',
    writeRole: null as Role | null,
    createdBy: actor.id
  })
  audit('channel_created', { userId: actor.id, email: g.user.email, resource: channel.id, meta: { name, visibility: channel.visibility } })
  return Response.json({ success: true, ok: true, channel })
}
