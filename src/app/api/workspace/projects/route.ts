import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { listProjects, createProject, activeUsers, companyOptions, type Actor } from '@/server/services/workspace/projectsRepo'
import type { ProjectKind, ProjectPriority, ProjectStatus, ProjectVisibility } from '@shared/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })

export async function GET(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const u = new URL(req.url)
  const projects = listProjects(actor, {
    status: (u.searchParams.get('status') as ProjectStatus) || undefined,
    companyId: u.searchParams.get('companyId') || undefined,
    archived: u.searchParams.get('archived') === '1',
    query: u.searchParams.get('q') || undefined
  })

  return Response.json({
    success: true, ok: true, projects,
    users: activeUsers(),
    companies: companyOptions(u.searchParams.get('company') || undefined),
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

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return Response.json({ success: false, ok: false, error: 'Das Projekt braucht einen Namen.' }, { status: 400 })

  const project = createProject(actor, {
    name,
    description: typeof body.description === 'string' ? body.description : '',
    kind: body.kind as ProjectKind,
    status: body.status as ProjectStatus,
    priority: body.priority as ProjectPriority,
    visibility: (body.visibility as ProjectVisibility) || 'team',
    color: (body.color as string) || undefined,
    companyId: (body.companyId as string) || null,
    leadId: (body.leadId as string) || null,
    startDate: (body.startDate as string) || null,
    dueDate: (body.dueDate as string) || null,
    withChat: body.withChat !== false, // Standard: Projektchat anlegen
    withFolder: body.withFolder !== false // Standard: Projektordner anlegen
  })

  audit('project_created', { userId: actor.id, email: g.user.email, resource: project.id, meta: { name, company: project.companyId } })
  return Response.json({ success: true, ok: true, project })
}
