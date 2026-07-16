import type { ProgressEvent } from '@shared/types'

/**
 * Ruft eine SSE-Pipeline-Route auf und liefert das Endergebnis,
 * während Fortschritts-Events an onProgress gehen.
 */
export async function runStream<TResult>(
  url: string,
  body: unknown,
  onProgress: (e: ProgressEvent) => void
): Promise<TResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok || !res.body) throw new Error(`Serverfehler (${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: TResult | undefined
  let error: string | undefined

  const handle = (block: string) => {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!dataLines.length) return
    const payload = JSON.parse(dataLines.join('\n'))
    if (event === 'progress') onProgress(payload as ProgressEvent)
    else if (event === 'result') result = payload as TResult
    else if (event === 'error') error = (payload as { message: string }).message
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      if (block.trim()) handle(block)
    }
  }
  if (buffer.trim()) handle(buffer)

  if (error) throw new Error(error)
  if (!result) throw new Error('Keine Ergebnisse erhalten.')
  return result
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fehler ${res.status}`)
  return res.json() as Promise<T>
}
