import type { AIPreviewProvider } from '@shared/types'
import { testProvider, validateProviderConfig } from '@/server/services/aiProviderSettings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * „Provider testen“: minimale Server-Anfrage. Antwort enthält NUR Erfolg/Fehler + kurze Meldung,
 * NIEMALS den API-Key oder rohe sensible Antwortdaten.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { provider?: AIPreviewProvider }
    const provider = body?.provider
    const valid: AIPreviewProvider[] = ['v0', 'claude', 'openai', 'ollama', 'manual']
    if (!provider || !valid.includes(provider)) return Response.json({ ok: false, error: 'Provider nicht konfiguriert.' }, { status: 400 })
    // Config-Status (synchron) + Live-Test (asynchron)
    const config = validateProviderConfig(provider)
    const live = await testProvider(provider)
    return Response.json({ ok: true, result: { ...live, config: { status: config.status, message: config.message } } })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
