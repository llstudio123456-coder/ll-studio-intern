import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { listTasks, createTask, taskCounts, assignableUsers, type Actor, type ListFilter } from '@/server/services/workspace/tasksRepo'
import type { TaskKind, TaskPriority, TaskStatus, TaskVisibility } from '@shared/tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })

export async function GET(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const u = new URL(req.url)
  const p = (k: string) => u.searchParams.get(k) || undefined
  // parent=root → nur Hauptaufgaben; Unteraufgaben hängen an ihrer Aufgabe.
  const parent = u.searchParams.get('parent')

  const filter: ListFilter = {
    view: (p('view') as ListFilter['view']) || 'alle',
    status: p('status') as TaskStatus | undefined,
    priority: p('priority') as TaskPriority | undefined,
    kind: p('kind') as TaskKind | undefined,
    companyId: p('companyId'),
    assigneeId: p('assigneeId'),
    parentId: parent === 'root' ? null : parent || undefined,
    query: p('q'),
    limit: p('limit') ? Number(p('limit')) : undefined
  }

  const { tasks, total } = listTasks(actor, filter)
  return Response.json({
    success: true,
    ok: true,
    tasks,
    total,
    counts: taskCounts(actor),
    users: assignableUsers(),
    me: { id: actor.id, role: actor.role }
  })
}

export async function POST(req: Request) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* ignore */
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return Response.json({ success: false, ok: false, error: 'Die Aufgabe braucht einen Titel.' }, { status: 400 })

  const task = createTask(actor, {
    title,
    description: typeof body.description === 'string' ? body.description : '',
    kind: body.kind as TaskKind,
    status: body.status as TaskStatus,
    priority: body.priority as TaskPriority,
    visibility: (body.visibility as TaskVisibility) || 'team',
    assigneeId: (body.assigneeId as string) || null,
    companyId: (body.companyId as string) || null,
    parentId: (body.parentId as string) || null,
    startDate: (body.startDate as string) || null,
    dueDate: (body.dueDate as string) || null,
    dueTime: (body.dueTime as string) || null,
    estimateMinutes: (body.estimateMinutes as number) ?? null,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    recurrence: (body.recurrence as never) || null,
    remindAt: (body.remindAt as string) || null
  })

  audit('task_created', { userId: actor.id, email: g.user.email, resource: task.id, meta: { title, assignee: task.assigneeId } })
  return Response.json({ success: true, ok: true, task })
}
