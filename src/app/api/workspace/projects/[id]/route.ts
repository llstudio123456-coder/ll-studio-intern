import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import {
  getProject, getProjectRaw, updateProject, isMember, addMember, removeMember,
  setArchived, trashProject, type Actor
} from '@/server/services/workspace/projectsRepo'
import { canEditProject, canManageProject, canReadProject, type ProjectVisibility } from '@shared/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
/** Nicht lesbar → 404 statt 403: Ein 403 würde die Existenz des Projekts bestätigen. */
const notFound = () => Response.json({ success: false, ok: false, error: 'Das Projekt wurde nicht gefunden.' }, { status: 404 })
const forbidden = () => Response.json({ success: false, ok: false, error: 'Für diese Aktion fehlt die Berechtigung.' }, { status: 403 })

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const project = getProject(actor, id)
  if (!project) return notFound()
  project.canEdit = canEditProject(actor, project, isMember(id, actor.id))
  return Response.json({ success: true, ok: true, project })
}

interface Body {
  action?: 'update' | 'archive' | 'unarchive' | 'trash' | 'addMember' | 'removeMember'
  visibility?: ProjectVisibility
  userId?: string
  [k: string]: unknown
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const raw = getProjectRaw(id)
  if (!raw || raw.deletedAt) return notFound()
  const member = isMember(id, actor.id)
  if (!canReadProject(actor, raw, member)) return notFound()

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  const mayEdit = canEditProject(actor, raw, member)
  const mayManage = canManageProject(actor, raw)

  switch (body.action) {
    case 'archive':
    case 'unarchive':
      if (!mayEdit) return forbidden()
      setArchived(id, body.action === 'archive')
      break
    case 'trash':
      // Löschen ist Verwaltungssache (Leitung/Ersteller/Admin), nicht jedes Mitglieds.
      if (!mayManage) return forbidden()
      trashProject(id, actor.id)
      audit('project_trashed', { userId: actor.id, email: g.user.email, resource: id, meta: { name: raw.name } })
      return Response.json({ success: true, ok: true })
    case 'addMember': {
      if (!mayManage) return forbidden()
      if (!body.userId) return Response.json({ success: false, ok: false, error: 'Keine Person angegeben.' }, { status: 400 })
      addMember(id, body.userId)
      break
    }
    case 'removeMember': {
      if (!mayManage) return forbidden()
      if (!body.userId) return Response.json({ success: false, ok: false, error: 'Keine Person angegeben.' }, { status: 400 })
      // Die Leitung kann nicht aus ihrem eigenen Projekt entfernt werden — sonst bliebe es
      // ohne Verantwortlichen zurück.
      if (body.userId === raw.leadId) return Response.json({ success: false, ok: false, error: 'Die Projektleitung kann nicht entfernt werden.' }, { status: 400 })
      removeMember(id, body.userId)
      break
    }
    case 'update':
    default: {
      if (!mayEdit) return forbidden()
      // Sichtbarkeit auf „privat" umzustellen ist Verwaltungssache — wer nur mitarbeitet, soll
      // ein Team-Projekt nicht plötzlich abschotten oder umgekehrt öffnen.
      if (body.visibility && body.visibility !== raw.visibility && !mayManage) return forbidden()
      updateProject(actor, id, body)
      break
    }
  }

  return Response.json({ success: true, ok: true, project: getProject(actor, id) })
}
