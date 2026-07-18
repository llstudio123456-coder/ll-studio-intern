import { randomUUID } from 'crypto'
import { getDb } from '../kundenfinder/db'
import type { Role } from '@shared/auth'
import {
  CLOSED_STATUSES, nextDueDate,
  type ChecklistItem, type Recurrence, type Task, type TaskKind, type TaskPriority, type TaskStatus, type TaskVisibility
} from '@shared/tasks'

const now = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)

export interface Actor {
  id: string
  role: Role
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toTask = (r: any): Task => ({
  id: r.id,
  title: r.title,
  description: r.description ?? '',
  kind: r.kind as TaskKind,
  status: r.status as TaskStatus,
  priority: r.priority as TaskPriority,
  visibility: r.visibility as TaskVisibility,
  creatorId: r.creator_id || undefined,
  creatorName: r.creator_name || undefined,
  assigneeId: r.assignee_id || undefined,
  assigneeName: r.assignee_name || undefined,
  companyId: r.company_id || undefined,
  companyName: r.company_name || undefined,
  parentId: r.parent_id || undefined,
  startDate: r.start_date || undefined,
  dueDate: r.due_date || undefined,
  dueTime: r.due_time || undefined,
  estimateMinutes: r.estimate_minutes ?? undefined,
  tags: parseTags(r.tags),
  recurrence: (r.recurrence as Recurrence) || undefined,
  remindAt: r.remind_at || undefined,
  completedAt: r.completed_at || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at || undefined
})
/* eslint-enable @typescript-eslint/no-explicit-any */

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * SQL-Bedingung für lesbare Aufgaben — spiegelt canReadTask() aus @shared/tasks.
 *
 * Als WHERE-Fragment und nicht als Filter danach: Sonst verrieten Trefferzahl und Blättern
 * die Existenz fremder privater Aufgaben.
 */
function visibilityClause(actor: Actor): { sql: string; params: unknown[] } {
  // 'private' erscheint hier NIE ohne Personenbezug — fremde private Aufgaben bleiben unsichtbar,
  // unabhängig von der Rolle.
  return {
    sql: "(t.creator_id = ? OR t.assignee_id = ? OR t.visibility = 'team')",
    params: [actor.id, actor.id]
  }
}

const BASE_SELECT = `
  SELECT t.*, cu.name AS creator_name, au.name AS assignee_name, c.name AS company_name
  FROM workspace_tasks t
  LEFT JOIN app_users cu ON cu.id = t.creator_id
  LEFT JOIN app_users au ON au.id = t.assignee_id
  LEFT JOIN companies c ON c.id = t.company_id
`

export interface ListFilter {
  view?: 'alle' | 'meine' | 'heute' | 'demnaechst' | 'ueberfaellig' | 'ohne_termin' | 'erledigt' | 'erstellt'
  status?: TaskStatus
  priority?: TaskPriority
  kind?: TaskKind
  companyId?: string
  assigneeId?: string
  parentId?: string | null
  projectId?: string
  query?: string
  limit?: number
  offset?: number
}

export function listTasks(actor: Actor, f: ListFilter = {}): { tasks: Task[]; total: number } {
  const db = getDb()
  const vis = visibilityClause(actor)
  const where: string[] = ['t.deleted_at IS NULL', vis.sql]
  const params: unknown[] = [...vis.params]

  const closed = CLOSED_STATUSES.map(() => '?').join(',')

  switch (f.view) {
    case 'meine':
      where.push('t.assignee_id = ?', `t.status NOT IN (${closed})`)
      params.push(actor.id, ...CLOSED_STATUSES)
      break
    case 'erstellt':
      where.push('t.creator_id = ?')
      params.push(actor.id)
      break
    case 'heute':
      where.push('t.due_date = ?', `t.status NOT IN (${closed})`)
      params.push(today(), ...CLOSED_STATUSES)
      break
    case 'demnaechst':
      where.push('t.due_date > ?', `t.status NOT IN (${closed})`)
      params.push(today(), ...CLOSED_STATUSES)
      break
    case 'ueberfaellig':
      where.push('t.due_date < ?', `t.status NOT IN (${closed})`)
      params.push(today(), ...CLOSED_STATUSES)
      break
    case 'ohne_termin':
      where.push('t.due_date IS NULL', `t.status NOT IN (${closed})`)
      params.push(...CLOSED_STATUSES)
      break
    case 'erledigt':
      where.push("t.status = 'erledigt'")
      break
    default:
      break
  }

  if (f.status) { where.push('t.status = ?'); params.push(f.status) }
  if (f.priority) { where.push('t.priority = ?'); params.push(f.priority) }
  if (f.kind) { where.push('t.kind = ?'); params.push(f.kind) }
  if (f.companyId) { where.push('t.company_id = ?'); params.push(f.companyId) }
  if (f.assigneeId) { where.push('t.assignee_id = ?'); params.push(f.assigneeId) }
  // parentId === null: nur Hauptaufgaben (Unteraufgaben hängen an ihrer Aufgabe)
  if (f.parentId === null) where.push('t.parent_id IS NULL')
  else if (f.parentId) { where.push('t.parent_id = ?'); params.push(f.parentId) }
  if (f.projectId) { where.push('t.project_id = ?'); params.push(f.projectId) }
  if (f.query?.trim()) {
    where.push('(LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(IFNULL(t.tags,\'\')) LIKE ?)')
    const q = `%${f.query.trim().toLowerCase()}%`
    params.push(q, q, q)
  }

  const whereSql = `WHERE ${where.join(' AND ')}`
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM workspace_tasks t ${whereSql}`).get(...params) as { n: number }).n

  const limit = Math.min(Math.max(f.limit ?? 100, 1), 300)
  const offset = Math.max(f.offset ?? 0, 0)

  // Sortierung: Überfällige zuerst, dann nach Termin, dann nach Priorität.
  const rows = db
    .prepare(
      `${BASE_SELECT} ${whereSql}
       ORDER BY
         CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
         t.due_date ASC,
         CASE t.priority WHEN 'dringend' THEN 0 WHEN 'hoch' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         t.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)
    .map(toTask)

  // Fortschritt der Unteraufgaben mitliefern — die Liste zeigt ihn an.
  for (const t of rows) {
    const sub = db
      .prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'erledigt' THEN 1 ELSE 0 END) AS d FROM workspace_tasks WHERE parent_id = ? AND deleted_at IS NULL")
      .get(t.id) as { n: number; d: number | null }
    if (sub.n > 0) {
      t.subtaskCount = sub.n
      t.subtasksDone = sub.d ?? 0
    }
  }

  return { tasks: rows, total }
}

export function getTask(actor: Actor, id: string): Task | null {
  const db = getDb()
  const vis = visibilityClause(actor)
  const r = db.prepare(`${BASE_SELECT} WHERE t.id = ? AND t.deleted_at IS NULL AND ${vis.sql}`).get(id, ...vis.params)
  if (!r) return null
  const t = toTask(r)
  t.checklist = listChecklist(id)
  return t
}

/** Rohzugriff ohne Sichtbarkeitsfilter — nur für Rechteprüfungen, nie für Antworten. */
export function getTaskRaw(id: string): Task | null {
  const r = getDb().prepare('SELECT * FROM workspace_tasks WHERE id = ?').get(id)
  return r ? toTask(r) : null
}

export function listChecklist(taskId: string): ChecklistItem[] {
  return getDb()
    .prepare('SELECT id, text, done, position FROM workspace_task_checklist WHERE task_id = ? ORDER BY position, created_at')
    .all(taskId)
    .map((r) => {
      const row = r as { id: string; text: string; done: number; position: number }
      return { id: row.id, text: row.text, done: !!row.done, position: row.position }
    })
}

export function createTask(actor: Actor, p: {
  title: string
  description?: string
  kind?: TaskKind
  status?: TaskStatus
  priority?: TaskPriority
  visibility?: TaskVisibility
  assigneeId?: string | null
  companyId?: string | null
  parentId?: string | null
  projectId?: string | null
  startDate?: string | null
  dueDate?: string | null
  dueTime?: string | null
  estimateMinutes?: number | null
  tags?: string[]
  recurrence?: Recurrence | null
  remindAt?: string | null
}): Task {
  const id = randomUUID()
  const t = now()
  getDb()
    .prepare(
      `INSERT INTO workspace_tasks
       (id,title,description,kind,status,priority,visibility,creator_id,assignee_id,company_id,parent_id,project_id,
        start_date,due_date,due_time,estimate_minutes,tags,recurrence,remind_at,created_at,updated_at,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      id,
      p.title.trim(),
      p.description ?? '',
      p.kind || 'persoenlich',
      p.status || 'offen',
      p.priority || 'normal',
      p.visibility || 'team',
      actor.id,
      p.assigneeId || null,
      p.companyId || null,
      p.parentId || null,
      p.projectId || null,
      p.startDate || null,
      p.dueDate || null,
      p.dueTime || null,
      p.estimateMinutes ?? null,
      JSON.stringify(p.tags || []),
      p.recurrence || null,
      p.remindAt || null,
      t,
      t,
      actor.id
    )
  return getTask(actor, id)!
}

export function updateTask(actor: Actor, id: string, p: Record<string, unknown>): Task | null {
  const db = getDb()
  const map: Record<string, string> = {
    title: 'title', description: 'description', kind: 'kind', status: 'status', priority: 'priority',
    visibility: 'visibility', assigneeId: 'assignee_id', companyId: 'company_id',
    startDate: 'start_date', dueDate: 'due_date', dueTime: 'due_time',
    estimateMinutes: 'estimate_minutes', recurrence: 'recurrence', remindAt: 'remind_at'
  }
  const sets: string[] = []
  const params: unknown[] = []
  for (const [k, col] of Object.entries(map)) {
    if (p[k] !== undefined) {
      sets.push(`${col} = ?`)
      params.push(k === 'title' ? String(p[k]).trim() : (p[k] ?? null))
    }
  }
  if (p.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(p.tags || [])) }
  if (sets.length === 0) return getTask(actor, id)

  sets.push('updated_at = ?', 'updated_by = ?')
  params.push(now(), actor.id)
  db.prepare(`UPDATE workspace_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
  return getTask(actor, id)
}

/**
 * Status setzen. Beim Abschluss einer wiederkehrenden Aufgabe entsteht automatisch die nächste —
 * gerechnet ab dem bisherigen Termin, nicht ab heute (sonst wandert ein wöchentlicher Termin
 * bei verspätetem Abhaken dauerhaft nach hinten).
 */
export function setStatus(actor: Actor, id: string, status: TaskStatus): { task: Task | null; followUp?: Task } {
  const db = getDb()
  const before = getTaskRaw(id)
  const t = now()

  if (status === 'erledigt') {
    db.prepare('UPDATE workspace_tasks SET status = ?, completed_at = ?, completed_by = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .run(status, t, actor.id, t, actor.id, id)
  } else {
    db.prepare('UPDATE workspace_tasks SET status = ?, completed_at = NULL, completed_by = NULL, updated_at = ?, updated_by = ? WHERE id = ?')
      .run(status, t, actor.id, id)
  }

  let followUp: Task | undefined
  if (status === 'erledigt' && before?.recurrence && before.dueDate) {
    followUp = createTask(actor, {
      title: before.title,
      description: before.description,
      kind: before.kind,
      priority: before.priority,
      visibility: before.visibility,
      assigneeId: before.assigneeId || null,
      companyId: before.companyId || null,
      dueDate: nextDueDate(before.dueDate, before.recurrence),
      dueTime: before.dueTime || null,
      estimateMinutes: before.estimateMinutes ?? null,
      tags: before.tags,
      recurrence: before.recurrence
    })
  }

  return { task: getTask(actor, id), followUp }
}

export function trashTask(id: string, by: string): void {
  getDb().prepare('UPDATE workspace_tasks SET deleted_at = ?, deleted_by = ? WHERE id = ?').run(now(), by, id)
}
export function restoreTask(id: string): void {
  getDb().prepare('UPDATE workspace_tasks SET deleted_at = NULL, deleted_by = NULL WHERE id = ?').run(id)
}
export function purgeTask(id: string): void {
  getDb().prepare('DELETE FROM workspace_tasks WHERE id = ?').run(id)
}

/* ── Checkliste ── */

export function addChecklistItem(taskId: string, text: string): ChecklistItem[] {
  const db = getDb()
  const max = (db.prepare('SELECT IFNULL(MAX(position),-1) AS p FROM workspace_task_checklist WHERE task_id = ?').get(taskId) as { p: number }).p
  db.prepare('INSERT INTO workspace_task_checklist (id,task_id,text,done,position,created_at) VALUES (?,?,?,0,?,?)')
    .run(randomUUID(), taskId, text.trim(), max + 1, now())
  return listChecklist(taskId)
}

export function toggleChecklistItem(taskId: string, itemId: string, done: boolean): ChecklistItem[] {
  getDb().prepare('UPDATE workspace_task_checklist SET done = ? WHERE id = ? AND task_id = ?').run(done ? 1 : 0, itemId, taskId)
  return listChecklist(taskId)
}

export function removeChecklistItem(taskId: string, itemId: string): ChecklistItem[] {
  getDb().prepare('DELETE FROM workspace_task_checklist WHERE id = ? AND task_id = ?').run(itemId, taskId)
  return listChecklist(taskId)
}

/** Zahlen für die Ansichtsleiste — dieselbe Sichtbarkeitsregel wie die Liste. */
export function taskCounts(actor: Actor): Record<string, number> {
  const views = ['meine', 'heute', 'demnaechst', 'ueberfaellig', 'ohne_termin'] as const
  const out: Record<string, number> = {}
  for (const v of views) out[v] = listTasks(actor, { view: v, limit: 1 }).total
  return out
}

/** Mitarbeiter, denen Aufgaben zugewiesen werden können. */
export function assignableUsers(): { id: string; name?: string; email: string }[] {
  return getDb()
    .prepare("SELECT id, name, email FROM app_users WHERE status = 'active' ORDER BY name COLLATE NOCASE, email")
    .all()
    .map((r) => {
      const row = r as { id: string; name: string | null; email: string }
      return { id: row.id, name: row.name || undefined, email: row.email }
    })
}
