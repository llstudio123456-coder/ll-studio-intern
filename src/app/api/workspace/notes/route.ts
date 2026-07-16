import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import { listNotes, createNote, listTags, type Actor } from '@/server/services/workspace/notesRepo'
import { assignableVisibilities, type NoteKind, type NoteVisibility } from '@shared/notes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Notizen des Benutzers. Die Sichtbarkeit filtert bereits in der SQL-Abfrage. */
export async function GET(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const u = new URL(req.url)
  const num = (k: string) => {
    const v = u.searchParams.get(k)
    return v ? Number(v) : undefined
  }

  const { notes, total } = listNotes(actor, {
    kind: (u.searchParams.get('kind') as NoteKind) || undefined,
    companyId: u.searchParams.get('companyId') || undefined,
    tag: u.searchParams.get('tag') || undefined,
    query: u.searchParams.get('q') || undefined,
    archived: u.searchParams.get('archived') === '1',
    favorite: u.searchParams.get('favorite') === '1',
    limit: num('limit'),
    offset: num('offset')
  })

  return Response.json({
    success: true,
    ok: true,
    notes,
    total,
    tags: listTags(actor),
    visibilities: assignableVisibilities(actor)
  })
}

/** Neue Notiz. Standard ist bewusst „private" — das Prinzip der geringsten Sichtbarkeit. */
export async function POST(req: Request) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  if (!g.user) return Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
  const actor: Actor = { id: g.user.id, role: g.user.role }

  let body: {
    kind?: NoteKind
    title?: string
    body?: string
    visibility?: NoteVisibility
    companyId?: string
    tags?: string[]
    color?: string
    remindAt?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    /* ignore */
  }

  const visibility = body.visibility || 'private'
  // Niemand darf eine Sichtbarkeit vergeben, die ihm selbst nicht offensteht — sonst könnte
  // ein Mitarbeiter eine „nur Inhaber"-Notiz anlegen, die er danach selbst nicht mehr sieht.
  if (!assignableVisibilities(actor).includes(visibility)) {
    return Response.json({ success: false, ok: false, error: 'Diese Sichtbarkeit kannst du nicht vergeben.' }, { status: 403 })
  }
  if (!body.body?.trim() && !body.title?.trim()) {
    return Response.json({ success: false, ok: false, error: 'Die Notiz ist leer.' }, { status: 400 })
  }

  const note = createNote(actor, { ...body, visibility })
  audit('note_created', { userId: actor.id, email: g.user.email, resource: note.id, meta: { kind: note.kind, visibility } })
  return Response.json({ success: true, ok: true, note })
}
