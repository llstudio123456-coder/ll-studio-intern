import type { ProgressEvent } from '@shared/types'

/**
 * Führt einen Pipeline-Lauf aus und streamt Fortschritt + Endergebnis als Server-Sent-Events.
 * Events: "progress" (ProgressEvent), "result" (Projekt), "error" ({message}).
 */
export function sseRun<T>(run: (emit: (e: ProgressEvent) => void) => Promise<T>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          /* Stream evtl. geschlossen */
        }
      }
      try {
        const result = await run((e) => send('progress', e))
        send('result', result)
      } catch (e) {
        send('error', { message: e instanceof Error ? e.message : String(e) })
      } finally {
        controller.close()
      }
    }
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}
