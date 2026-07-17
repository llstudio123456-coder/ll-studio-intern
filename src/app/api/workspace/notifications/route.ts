import { guardApi } from '@/server/auth/guard'
import { listNotifications, unreadCount, markRead, markAllRead } from '@/server/services/workspace/notificationsRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const needsUser = () => Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })

/** Eigene Benachrichtigungen. Es gibt bewusst keinen Weg, fremde abzurufen. */
export async function GET(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()

  const u = new URL(req.url)
  return Response.json({
    success: true,
    ok: true,
    notifications: listNotifications(g.user.id, { unreadOnly: u.searchParams.get('unread') === '1' }),
    unread: unreadCount(g.user.id)
  })
}

export async function POST(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return needsUser()

  let body: { action?: 'read' | 'readAll'; id?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* ignore */
  }

  if (body.action === 'readAll') {
    return Response.json({ success: true, ok: true, changed: markAllRead(g.user.id), unread: 0 })
  }
  if (!body.id) return Response.json({ success: false, ok: false, error: 'Keine Benachrichtigung angegeben.' }, { status: 400 })

  // Die Benutzer-ID steckt im WHERE der Abfrage: Eine fremde ID zu schicken bewirkt schlicht
  // nichts — es gibt keinen Weg, fremde Zeilen zu markieren.
  markRead(g.user.id, body.id)
  return Response.json({ success: true, ok: true, unread: unreadCount(g.user.id) })
}
