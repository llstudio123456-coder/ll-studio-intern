import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import {
  getChannelRaw, isMember, listMessages, pinnedMessages, createMessage, markRead,
  channelMembers, eventRecipients, activeUsers, join, leave, archiveChannel, type Actor
} from '@/server/services/workspace/chatRepo'
import { publish } from '@/server/services/workspace/chatBus'
import { notify } from '@/server/services/workspace/notificationsRepo'
import { canReadChannel, canWriteChannel, parseMentions, messageExcerpt } from '@shared/chat'
import { roleAtLeast } from '@shared/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
/** Nicht lesbar → 404 statt 403: Ein 403 würde die Existenz des Kanals bestätigen (Spez. §22). */
const notFound = () => Response.json({ success: false, ok: false, error: 'Der Kanal wurde nicht gefunden.' }, { status: 404 })

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const ch = getChannelRaw(id)
  if (!ch) return notFound()
  const member = isMember(id, actor.id)
  if (!canReadChannel(actor, ch, member)) return notFound()

  const u = new URL(req.url)
  const messages = listMessages(id, {
    before: u.searchParams.get('before') || undefined,
    query: u.searchParams.get('q') || undefined
  })
  // Öffnen zählt als Lesen — dabei wird man Mitglied und behält seinen Ungelesen-Stand.
  if (!u.searchParams.get('q')) markRead(id, actor.id)

  ch.isMember = true
  ch.canWrite = canWriteChannel(actor, ch, true)
  ch.members = channelMembers(id)

  return Response.json({
    success: true,
    ok: true,
    channel: ch,
    messages: messages.map((m) => ({ ...m, canEdit: m.authorId === actor.id })),
    pinned: pinnedMessages(id),
    users: activeUsers()
  })
}

interface Body {
  action?: 'send' | 'join' | 'leave' | 'archive' | 'unarchive'
  body?: string
  replyTo?: string
  fileId?: string
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const ch = getChannelRaw(id)
  if (!ch) return notFound()
  const member = isMember(id, actor.id)
  if (!canReadChannel(actor, ch, member)) return notFound()

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  switch (body.action) {
    case 'join':
      join(id, actor.id)
      return Response.json({ success: true, ok: true })
    case 'leave':
      leave(id, actor.id)
      return Response.json({ success: true, ok: true })
    case 'archive':
    case 'unarchive': {
      if (!roleAtLeast(actor.role, 'admin')) {
        return Response.json({ success: false, ok: false, error: 'Nur Administratoren können Kanäle archivieren.' }, { status: 403 })
      }
      archiveChannel(id, body.action === 'archive')
      audit(`channel_${body.action}`, { userId: actor.id, email: g.user.email, resource: id, meta: { name: ch.name } })
      return Response.json({ success: true, ok: true })
    }
    case 'send':
    default: {
      // Lesen genügt nicht: Der Ankündigungskanal ist für Mitarbeiter bewusst nur lesbar,
      // und Gäste/Viewer schreiben nirgends.
      if (!canWriteChannel(actor, ch, member)) {
        return Response.json({ success: false, ok: false, error: 'In diesem Kanal darfst du nicht schreiben.' }, { status: 403 })
      }
      const text = (body.body || '').trim()
      if (!text && !body.fileId) {
        return Response.json({ success: false, ok: false, error: 'Die Nachricht ist leer.' }, { status: 400 })
      }
      if (text.length > 8000) {
        return Response.json({ success: false, ok: false, error: 'Die Nachricht ist zu lang (max. 8000 Zeichen).' }, { status: 400 })
      }

      const mentions = parseMentions(text, activeUsers())
      const msg = createMessage({
        channelId: id,
        authorId: actor.id,
        body: text,
        replyTo: body.replyTo || null,
        fileId: body.fileId || null,
        mentions
      })

      // Nur an den berechtigten Kreis verteilen — ein Ereignis ist selbst schon eine Information.
      publish(eventRecipients(id), { type: 'message', channelId: id, messageId: msg.id })

      const von = g.user.name || g.user.email
      const link = `/workspace/chat?kanal=${id}`
      if (ch.kind === 'dm') {
        // Bei Direktnachrichten zählt jede Nachricht, nicht nur eine Erwähnung.
        notify({
          userIds: channelMembers(id).map((m) => m.id),
          kind: 'dm',
          title: `Neue Nachricht von ${von}`,
          body: messageExcerpt(text, 120),
          link, actorId: actor.id, sourceType: 'message', sourceId: msg.id
        })
      } else {
        // Erwähnte nur benachrichtigen, wenn sie den Kanal auch lesen dürfen — sonst führte die
        // Benachrichtigung ins Leere und verriete zugleich, dass es den Kanal gibt.
        const erlaubt = new Set(eventRecipients(id))
        notify({
          userIds: mentions.filter((u) => erlaubt.has(u)),
          kind: 'mention',
          title: `${von} hat dich in „${ch.name}" erwähnt`,
          body: messageExcerpt(text, 120),
          link, actorId: actor.id, sourceType: 'message', sourceId: msg.id
        })
        // Ankündigungen erreichen alle Leseberechtigten, auch ohne Erwähnung.
        if (ch.writeRole) {
          notify({
            userIds: [...erlaubt],
            kind: 'announcement',
            title: `Ankündigung von ${von}`,
            body: messageExcerpt(text, 120),
            link, actorId: actor.id, sourceType: 'message', sourceId: msg.id
          })
        }
      }

      return Response.json({ success: true, ok: true, message: { ...msg, canEdit: true } })
    }
  }
}
