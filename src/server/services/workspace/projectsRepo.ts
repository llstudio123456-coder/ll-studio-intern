import { randomUUID } from 'crypto'
import { getDb } from '../kundenfinder/db'
import { createChannel, join as joinChannel } from './chatRepo'
import { createFolder } from './filesRepo'
import { projectProgress, type Project, type ProjectKind, type ProjectPriority, type ProjectStatus, type ProjectVisibility } from '@shared/projects'
import type { Role } from '@shared/auth'

const now = () => new Date().toISOString()

export interface Actor {
  id: string
  role: Role
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toProject = (r: any): Project => ({
  id: r.id,
  name: r.name,
  description: r.description ?? '',
  kind: r.kind as ProjectKind,
  status: r.status as ProjectStatus,
  priority: r.priority as ProjectPriority,
  visibility: r.visibility as ProjectVisibility,
  color: r.color || undefined,
  companyId: r.company_id || undefined,
  companyName: r.company_name || undefined,
  leadId: r.lead_id || undefined,
  leadName: r.lead_name || undefined,
  chatChannelId: r.chat_channel_id || undefined,
  folderId: r.folder_id || undefined,
  startDate: r.start_date || undefined,
  dueDate: r.due_date || undefined,
  completedAt: r.completed_at || undefined,
  createdBy: r.created_by || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  archivedAt: r.archived_at || undefined,
  deletedAt: r.deleted_at || undefined
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export function isMember(projectId: string, userId: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM workspace_project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId)
}

/** Spiegelt canReadProject: Projektleitung, Mitglied oder Team-Sichtbarkeit. */
function visibilityClause(actor: Actor): { sql: string; params: unknown[] } {
  return {
    sql: "(p.lead_id = ? OR EXISTS (SELECT 1 FROM workspace_project_members m WHERE m.project_id = p.id AND m.user_id = ?) OR p.visibility = 'team')",
    params: [actor.id, actor.id]
  }
}

const BASE_SELECT = `
  SELECT p.*, c.name AS company_name, u.name AS lead_name,
         (SELECT COUNT(*) FROM workspace_tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
         (SELECT COUNT(*) FROM workspace_tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL AND t.status = 'erledigt') AS task_done
  FROM workspace_projects p
  LEFT JOIN companies c ON c.id = p.company_id
  LEFT JOIN app_users u ON u.id = p.lead_id
`

function decorate(p: Project, taskCount: number, taskDone: number): Project {
  p.taskCount = taskCount
  p.taskDone = taskDone
  p.progress = projectProgress(taskCount, taskDone)
  return p
}

export function listProjects(actor: Actor, opts: { status?: ProjectStatus; companyId?: string; archived?: boolean; query?: string } = {}): Project[] {
  const vis = visibilityClause(actor)
  const where: string[] = ['p.deleted_at IS NULL', vis.sql]
  const params: unknown[] = [...vis.params]

  where.push(opts.archived ? 'p.archived_at IS NOT NULL' : 'p.archived_at IS NULL')
  if (opts.status) { where.push('p.status = ?'); params.push(opts.status) }
  if (opts.companyId) { where.push('p.company_id = ?'); params.push(opts.companyId) }
  if (opts.query?.trim()) {
    where.push('(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)')
    const q = `%${opts.query.trim().toLowerCase()}%`
    params.push(q, q)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getDb()
    .prepare(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY CASE p.status WHEN 'aktiv' THEN 0 ELSE 1 END, p.updated_at DESC`)
    .all(...params)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => decorate(toProject(r), r.task_count ?? 0, r.task_done ?? 0))
}

export function getProject(actor: Actor, id: string): Project | null {
  const vis = visibilityClause(actor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = getDb().prepare(`${BASE_SELECT} WHERE p.id = ? AND p.deleted_at IS NULL AND ${vis.sql}`).get(id, ...vis.params) as any
  if (!r) return null
  const p = decorate(toProject(r), r.task_count ?? 0, r.task_done ?? 0)
  p.members = listMembers(id)
  return p
}

export function getProjectRaw(id: string): Project | null {
  const r = getDb().prepare('SELECT * FROM workspace_projects WHERE id = ?').get(id)
  return r ? toProject(r) : null
}

export function listMembers(projectId: string): { id: string; name?: string; email: string; role: string }[] {
  return getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, m.role FROM workspace_project_members m
       JOIN app_users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY u.name COLLATE NOCASE, u.email`
    )
    .all(projectId)
    .map((r) => {
      const row = r as { id: string; name: string | null; email: string; role: string }
      return { id: row.id, name: row.name || undefined, email: row.email, role: row.role }
    })
}

/**
 * Neues Projekt. Legt auf Wunsch gleich einen Projektchat und einen Projektordner an — so ist das
 * Projekt von Beginn an mit Chat und Ablage verbunden, statt ein leeres Gerüst zu sein.
 */
export function createProject(actor: Actor, p: {
  name: string
  description?: string
  kind?: ProjectKind
  status?: ProjectStatus
  priority?: ProjectPriority
  visibility?: ProjectVisibility
  color?: string
  companyId?: string | null
  leadId?: string | null
  startDate?: string | null
  dueDate?: string | null
  withChat?: boolean
  withFolder?: boolean
}): Project {
  const db = getDb()
  const id = randomUUID()
  const t = now()
  const leadId = p.leadId || actor.id

  let chatChannelId: string | null = null
  if (p.withChat) {
    const ch = createChannel({
      name: `Projekt: ${p.name.trim()}`,
      description: 'Automatisch angelegter Projektchat.',
      kind: 'projekt',
      // Ein privates Projekt bekommt einen privaten Chat — sonst läse das ganze Team mit.
      visibility: p.visibility === 'private' ? 'privat' : 'offen',
      companyId: p.companyId || null,
      createdBy: actor.id
    })
    chatChannelId = ch.id
    if (leadId !== actor.id) joinChannel(ch.id, leadId)
  }

  let folderId: string | null = null
  if (p.withFolder) {
    folderId = createFolder(null, `Projekt – ${p.name.trim()}`, actor.id).id
  }

  db.prepare(
    `INSERT INTO workspace_projects
     (id,name,description,kind,status,priority,visibility,color,company_id,lead_id,chat_channel_id,folder_id,start_date,due_date,created_by,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, p.name.trim(), p.description ?? '', p.kind || 'website', p.status || 'geplant', p.priority || 'normal',
    p.visibility || 'team', p.color || null, p.companyId || null, leadId, chatChannelId, folderId,
    p.startDate || null, p.dueDate || null, actor.id, t, t
  )

  // Ersteller und Leitung sind Mitglieder.
  addMember(id, actor.id, 'leitung')
  if (leadId !== actor.id) addMember(id, leadId, 'leitung')

  return getProject(actor, id)!
}

export function updateProject(actor: Actor, id: string, p: Record<string, unknown>): Project | null {
  const map: Record<string, string> = {
    name: 'name', description: 'description', kind: 'kind', status: 'status', priority: 'priority',
    visibility: 'visibility', color: 'color', companyId: 'company_id', leadId: 'lead_id',
    startDate: 'start_date', dueDate: 'due_date'
  }
  const sets: string[] = []
  const params: unknown[] = []
  for (const [k, col] of Object.entries(map)) {
    if (p[k] !== undefined) { sets.push(`${col} = ?`); params.push(k === 'name' ? String(p[k]).trim() : (p[k] ?? null)) }
  }
  // Abschlussdatum automatisch mitführen.
  if (p.status !== undefined) {
    sets.push('completed_at = ?')
    params.push(p.status === 'abgeschlossen' ? now() : null)
  }
  if (sets.length === 0) return getProject(actor, id)
  sets.push('updated_at = ?')
  params.push(now())
  getDb().prepare(`UPDATE workspace_projects SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
  return getProject(actor, id)
}

export function addMember(projectId: string, userId: string, role = 'mitglied'): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO workspace_project_members (project_id,user_id,role,added_at) VALUES (?,?,?,?)')
    .run(projectId, userId, role, now())
}
export function removeMember(projectId: string, userId: string): void {
  getDb().prepare('DELETE FROM workspace_project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId)
}

export function setArchived(id: string, archived: boolean): void {
  getDb().prepare('UPDATE workspace_projects SET archived_at = ?, updated_at = ? WHERE id = ?').run(archived ? now() : null, now(), id)
}
export function trashProject(id: string, by: string): void {
  getDb().prepare('UPDATE workspace_projects SET deleted_at = ?, deleted_by = ? WHERE id = ?').run(now(), by, id)
}

/** Aufgaben eines Projekts (für die Projektzentrale). */
export function projectTaskIds(projectId: string): number {
  const r = getDb().prepare('SELECT COUNT(*) AS n FROM workspace_tasks WHERE project_id = ? AND deleted_at IS NULL').get(projectId) as { n: number }
  return r.n
}

export function activeUsers(): { id: string; name?: string; email: string }[] {
  return getDb()
    .prepare("SELECT id, name, email FROM app_users WHERE status = 'active' ORDER BY name COLLATE NOCASE, email")
    .all()
    .map((r) => {
      const row = r as { id: string; name: string | null; email: string }
      return { id: row.id, name: row.name || undefined, email: row.email }
    })
}

/** Kunden für die Projektzuordnung (leichte Liste, keine Massendaten). */
export function companyOptions(query?: string): { id: string; name: string }[] {
  const q = (query || '').trim().toLowerCase()
  const rows = q
    ? getDb().prepare('SELECT id, name FROM companies WHERE LOWER(name) LIKE ? ORDER BY name COLLATE NOCASE LIMIT 30').all(`%${q}%`)
    : getDb().prepare('SELECT id, name FROM companies ORDER BY updated_at DESC LIMIT 30').all()
  return rows.map((r) => { const row = r as { id: string; name: string }; return { id: row.id, name: row.name } })
}
