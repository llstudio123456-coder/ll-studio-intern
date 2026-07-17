import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import {
  getMessage, getChannelRaw, isMember, updateMessage, deleteMessage, setPinned, eventRecipients, type Actor
} from '@/server/services/workspace/chatRepo'
import { publish } from '@/server/services/workspace/chatBus'
import { createTask } from '@/server/services/workspace/tasksRepo'
import { createNote } from '@/server/services/workspace/notesRepo'
import { canEditMessage, canPinMessage, canReadChannel, messageExcerpt } from '@shared/chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
const notFound = () => Response.json({ success: false, ok: false, error: 'Die Nachricht wurde nicht gefunden.' }, { status: 404 })
const forbidden = () => Response.json({ success: false, ok: false, error: 'Für diese Aktion fehlt die Berechtigung.' }, { status: 403 })

interface Body {
  action?: 'edit' | 'delete' | 'pin' | 'unpin' | 'toTask' | 'toNote'
  body?: string
  /** Für toTask/toNote */
  title?: string
  dueDate?: string
  assigneeId?: string
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const msg = getMessage(id)
  if (!msg) return notFound()

  // Zugriff hängt am Kanal: Wer den Kanal nicht lesen darf, darf auch die Nachricht nicht
  // über ihre direkte ID erreichen.
  const ch = getChannelRaw(msg.channelId)
  if (!ch || !canReadChannel(actor, ch, isMember(msg.channelId, actor.id))) return notFound()

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  switch (body.action) {
    case 'edit': {
      if (!canEditMessage(actor, msg)) return forbidden()
      const text = (body.body || '').trim()
      if (!text) return Response.json({ success: false, ok: false, error: 'Die Nachricht ist leer.' }, { status: 400 })
      const updated = updateMessage(id, text)
      publish(eventRecipients(msg.channelId), { type: 'update', channelId: msg.channelId, messageId: id })
      return Response.json({ success: true, ok: true, message: updated })
    }
    case 'delete': {
      if (!canEditMessage(actor, msg)) return forbidden()
      deleteMessage(id)
      // Der Eintrag bleibt bestehen (Text geleert): Sonst zerfielen Antwortketten und das
      // Audit-Log verlöre den Bezug (Spezifikation §11).
      audit('message_deleted', { userId: actor.id, email: g.user.email, resource: id, meta: { channel: ch.name } })
      publish(eventRecipients(msg.channelId), { type: 'delete', channelId: msg.channelId, messageId: id })
      return Response.json({ success: true, ok: true })
    }
    case 'pin':
    case 'unpin': {
      if (!canPinMessage(actor, msg)) return forbidden()
      setPinned(id, body.action === 'pin')
      publish(eventRecipients(msg.channelId), { type: 'update', channelId: msg.channelId, messageId: id })
      return Response.json({ success: true, ok: true })
    }
    case 'toTask': {
      // Aus einer Nachricht eine Aufgabe machen (Spezifikation §24). Der Bezug bleibt im Text
      // erhalten, damit man später nachvollzieht, woher die Aufgabe stammt.
      const title = (body.title || messageExcerpt(msg.body, 80)).trim()
      if (!title) return Response.json({ success: false, ok: false, error: 'Die Nachricht ist leer.' }, { status: 400 })
      const task = createTask(actor, {
        title,
        description: `Aus dem Chat (${ch.name})${msg.authorName ? `, von ${msg.authorName}` : ''}:\n\n${msg.body}`,
        kind: 'team',
        visibility: 'team',
        assigneeId: body.assigneeId || actor.id,
        companyId: ch.companyId || null,
        dueDate: body.dueDate || null
      })
      audit('message_to_task', { userId: actor.id, email: g.user.email, resource: task.id, meta: { messageId: id } })
      return Response.json({ success: true, ok: true, task })
    }
    case 'toNote': {
      const note = createNote(actor, {
        kind: 'gespraech',
        title: (body.title || messageExcerpt(msg.body, 60)).trim() || undefined,
        body: `Aus dem Chat (${ch.name})${msg.authorName ? `, von ${msg.authorName}` : ''}:\n\n${msg.body}`,
        // Bewusst 'private': Eine Notiz aus einer Nachricht ist erst einmal eine persönliche
        // Mitschrift. Wer sie teilen will, entscheidet das selbst.
        visibility: 'private',
        companyId: ch.companyId || undefined
      })
      audit('message_to_note', { userId: actor.id, email: g.user.email, resource: note.id, meta: { messageId: id } })
      return Response.json({ success: true, ok: true, note })
    }
    default:
      return Response.json({ success: false, ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
  }
}
