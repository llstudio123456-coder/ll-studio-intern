import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import {
  getTask, getTaskRaw, updateTask, setStatus, trashTask, restoreTask, purgeTask,
  addChecklistItem, toggleChecklistItem, removeChecklistItem, type Actor
} from '@/server/services/workspace/tasksRepo'
import { notify } from '@/server/services/workspace/notificationsRepo'
import { canDeleteTask, canEditTask, canReadTask, type TaskStatus } from '@shared/tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
const notFound = () => Response.json({ success: false, ok: false, error: 'Die Aufgabe wurde nicht gefunden.' }, { status: 404 })
const forbidden = () => Response.json({ success: false, ok: false, error: 'Für diese Aktion fehlt die Berechtigung.' }, { status: 403 })

/** Nicht lesbar → 404 statt 403: Ein 403 würde die Existenz der Aufgabe bestätigen. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const task = getTask(actor, id)
  if (!task) return notFound()
  task.canEdit = canEditTask(actor, task)
  return Response.json({ success: true, ok: true, task })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const raw = getTaskRaw(id)
  if (!raw) return notFound()
  // Auch für gelöschte Aufgaben gilt: Wer sie nicht lesen darf, erfährt nicht, dass es sie gibt.
  if (!canReadTask(actor, raw)) return notFound()

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* ignore */
  }

  const action = String(body.action || 'update')
  const mayEdit = canEditTask(actor, raw)
  const mayDelete = canDeleteTask(actor, raw)

  switch (action) {
    case 'status': {
      if (!mayEdit) return forbidden()
      const status = body.status as TaskStatus
      if (!status) return Response.json({ success: false, ok: false, error: 'Kein Status angegeben.' }, { status: 400 })
      const { task, followUp } = setStatus(actor, id, status)
      audit('task_status', { userId: actor.id, email: g.user.email, resource: id, meta: { status, followUp: followUp?.id } })
      // followUp entsteht nur bei wiederkehrenden Aufgaben — die Oberfläche weist darauf hin.
      return Response.json({ success: true, ok: true, task, followUp })
    }
    case 'trash': {
      if (!mayDelete) return forbidden()
      trashTask(id, actor.id)
      break
    }
    case 'restore': {
      if (!mayDelete) return forbidden()
      restoreTask(id)
      break
    }
    case 'purge': {
      if (!mayDelete) return forbidden()
      purgeTask(id)
      audit('task_purged', { userId: actor.id, email: g.user.email, resource: id })
      return Response.json({ success: true, ok: true })
    }
    case 'checklist.add': {
      if (!mayEdit) return forbidden()
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return Response.json({ success: false, ok: false, error: 'Kein Text angegeben.' }, { status: 400 })
      return Response.json({ success: true, ok: true, checklist: addChecklistItem(id, text) })
    }
    case 'checklist.toggle': {
      if (!mayEdit) return forbidden()
      return Response.json({ success: true, ok: true, checklist: toggleChecklistItem(id, String(body.itemId), !!body.done) })
    }
    case 'checklist.remove': {
      if (!mayEdit) return forbidden()
      return Response.json({ success: true, ok: true, checklist: removeChecklistItem(id, String(body.itemId)) })
    }
    case 'update':
    default: {
      if (!mayEdit) return forbidden()
      // Die Sichtbarkeit darf nur der Ersteller ändern: Wer mitarbeiten darf, soll eine private
      // Aufgabe nicht fürs ganze Team öffnen.
      if (body.visibility && body.visibility !== raw.visibility && !mayDelete) return forbidden()
      updateTask(actor, id, body)
      // Nur bei einem WECHSEL benachrichtigen: Sonst bekäme der Zuständige bei jeder
      // Kleinigkeit — Termin, Priorität, Tippfehler — erneut eine Meldung.
      const neu = body.assigneeId as string | undefined
      if (neu && neu !== raw.assigneeId) {
        notify({
          userIds: [neu],
          kind: 'task_assigned',
          title: `${g.user.name || g.user.email} hat dir eine Aufgabe zugewiesen`,
          body: raw.title,
          link: '/workspace/aufgaben?view=meine',
          actorId: actor.id,
          sourceType: 'task',
          sourceId: id
        })
      }
      break
    }
  }

  return Response.json({ success: true, ok: true, task: getTask(actor, id) })
}
