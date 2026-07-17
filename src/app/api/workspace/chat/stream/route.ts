import { guardApi } from '@/server/auth/guard'
import { subscribe, type ChatEvent } from '@/server/services/workspace/chatBus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Echtzeit-Strom (Server-Sent Events).
 *
 * SSE statt WebSocket: Der Chat braucht nur eine Richtung (Server → Client), Nachrichten gehen
 * ohnehin per POST raus. SSE läuft über normales HTTP, wird von der Middleware wie jede andere
 * Route geprüft und braucht keinen zweiten Verbindungsweg.
 *
 * Die Rechteprüfung passiert BEIM VERTEILEN (chatRepo.eventRecipients), nicht hier: Der Strom
 * ist an die Benutzer-ID gebunden und erhält nur Ereignisse aus Kanälen, die diese Person
 * lesen darf. Ein Ereignis ist selbst schon eine Information.
 */
export async function GET(req: Request) {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response
  if (!g.user) return Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
  const userId = g.user.id

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          // Verbindung ist weg — aufräumen, statt in einer Schleife zu scheitern.
          cleanup()
        }
      }

      send(': verbunden\n\n')

      unsubscribe = subscribe(userId, (e: ChatEvent) => {
        send(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
      })

      // Ohne regelmäßiges Lebenszeichen kappen Proxys die Verbindung nach ~60 s.
      heartbeat = setInterval(() => send(': ping\n\n'), 25_000)

      function cleanup() {
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        try {
          controller.close()
        } catch {
          /* bereits geschlossen */
        }
      }

      // Schließt der Browser den Tab, muss der Abonnent verschwinden — sonst wächst die
      // Zuhörerliste unbegrenzt.
      req.signal.addEventListener('abort', cleanup)
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      if (unsubscribe) unsubscribe()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Verhindert Pufferung durch zwischengeschaltete Proxys — sonst kommt nichts in Echtzeit an.
      'X-Accel-Buffering': 'no'
    }
  })
}
