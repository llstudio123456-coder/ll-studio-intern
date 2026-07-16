import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'
import {
  getNote, getNoteRaw, updateNote, trashNote, restoreNote, purgeNote, setArchived,
  setShares, sharedUserIds, listShares, type Actor
} from '@/server/services/workspace/notesRepo'
import { assignableVisibilities, canDeleteNote, canEditNote, canReadNote, type NoteShare, type NoteVisibility } from '@shared/notes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Einzelne Notiz.
 *
 * Für eine nicht lesbare Notiz gibt es bewusst 404 statt 403: Ein 403 würde bestätigen, dass die
 * Notiz existiert. Bei privaten Notizen wäre schon das ein Informationsleck.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  const note = getNote(actor, id)
  if (!note) return Response.json({ success: false, ok: false, error: 'Die Notiz wurde nicht gefunden.' }, { status: 404 })

  note.canEdit = canEditNote(actor, note, listShares(id))
  return Response.json({ success: true, ok: true, note })
}

interface Body {
  action?: 'update' | 'trash' | 'restore' | 'purge' | 'archive' | 'unarchive' | 'share'
  kind?: string
  title?: string
  body?: string
  visibility?: NoteVisibility
  companyId?: string | null
  tags?: string[]
  color?: string | null
  remindAt?: string | null
  pinned?: boolean
  favorite?: boolean
  shares?: NoteShare[]
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardApi({ role: 'member' })
  if (!g.ok) return g.response
  if (!g.user) return Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
  const actor: Actor = { id: g.user.id, role: g.user.role }

  const { id } = await ctx.params
  // Rohzugriff nur für die Rechteprüfung — der Inhalt verlässt diese Route nie ungeprüft.
  const raw = getNoteRaw(id)
  if (!raw || raw.deletedAt) {
    // Auch hier 404 statt 403, siehe GET.
    const deletedButMine = raw?.deletedAt && raw.ownerId === actor.id
    if (!deletedButMine) return Response.json({ success: false, ok: false, error: 'Die Notiz wurde nicht gefunden.' }, { status: 404 })
  }
  const note = raw!
  if (!canReadNote(actor, note, sharedUserIds(id))) {
    return Response.json({ success: false, ok: false, error: 'Die Notiz wurde nicht gefunden.' }, { status: 404 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* ignore */
  }

  const mayEdit = canEditNote(actor, note, listShares(id))
  const mayDelete = canDeleteNote(actor, note)

  switch (body.action) {
    case 'restore': {
      if (!mayDelete) return forbidden()
      restoreNote(id)
      break
    }
    case 'purge': {
      // Endgültiges Löschen bleibt beim Besitzer — ein Admin soll fremde private Notizen
      // nicht entfernen können, die er nie sehen durfte.
      if (!mayDelete) return forbidden()
      purgeNote(id)
      audit('note_purged', { userId: actor.id, email: g.user.email, resource: id })
      return Response.json({ success: true, ok: true })
    }
    case 'trash': {
      if (!mayDelete) return forbidden()
      trashNote(id, actor.id)
      break
    }
    case 'archive':
    case 'unarchive': {
      if (!mayEdit) return forbidden()
      setArchived(id, body.action === 'archive')
      break
    }
    case 'share': {
      // Freigeben darf nur der Besitzer — sonst könnte ein Mitleser die Runde erweitern.
      if (!canDeleteNote(actor, note)) return forbidden()
      setShares(id, (body.shares || []).filter((s) => s.userId && s.userId !== actor.id))
      audit('note_shared', { userId: actor.id, email: g.user.email, resource: id, meta: { count: body.shares?.length ?? 0 } })
      break
    }
    case 'update':
    default: {
      if (!mayEdit) return forbidden()
      if (body.visibility && !assignableVisibilities(actor).includes(body.visibility)) {
        return Response.json({ success: false, ok: false, error: 'Diese Sichtbarkeit kannst du nicht vergeben.' }, { status: 403 })
      }
      // Die Sichtbarkeit darf nur der Besitzer ändern: Wer mitschreiben darf, soll den Kreis
      // der Mitleser nicht erweitern können.
      if (body.visibility && body.visibility !== note.visibility && !canDeleteNote(actor, note)) {
        return forbidden()
      }
      updateNote(actor, id, {
        kind: body.kind as never,
        title: body.title,
        body: body.body,
        visibility: body.visibility,
        companyId: body.companyId,
        tags: body.tags,
        color: body.color,
        remindAt: body.remindAt,
        pinned: body.pinned,
        favorite: body.favorite
      })
      break
    }
  }

  return Response.json({ success: true, ok: true, note: getNote(actor, id) })
}

const forbidden = () => Response.json({ success: false, ok: false, error: 'Für diese Aktion fehlt die Berechtigung.' }, { status: 403 })
