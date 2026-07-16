import type { AIPreviewProvider, ProviderConfig, ProviderStatus } from '@shared/types'
import { loadConfig } from './config'

/** Standard-Modelle je Provider, falls in der Config keines gesetzt ist. */
const DEFAULT_MODELS: Record<AIPreviewProvider, string> = {
  v0: 'v0-1.5-md',
  claude: 'claude-opus-4-8',
  openai: 'gpt-4o-mini',
  ollama: 'llama3.1',
  manual: '—'
}

const LABELS: Record<AIPreviewProvider, string> = {
  v0: 'v0 (Vercel)',
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI',
  ollama: 'Ollama (lokal)',
  manual: 'Manueller Export'
}

/** Liefert Konfiguration/Erreichbarkeit aller Provider – ohne Keys preiszugeben. */
export function getProviderConfigs(): ProviderConfig[] {
  const c = loadConfig(true)
  const cfg: ProviderConfig[] = [
    {
      provider: 'v0',
      label: LABELS.v0,
      model: c.v0Model || DEFAULT_MODELS.v0,
      requiresKey: true,
      hasKey: !!c.v0ApiKey,
      available: !!c.v0ApiKey,
      note: 'React/Tailwind-optimiert. Ohne API-Key nur manueller Prompt-Export.'
    },
    {
      provider: 'claude',
      label: LABELS.claude,
      model: c.claudeModel || DEFAULT_MODELS.claude,
      requiresKey: true,
      hasKey: !!c.claudeApiKey,
      available: !!c.claudeApiKey,
      note: 'HTML/CSS oder React/Tailwind. Ohne API-Key nur manueller Export.'
    },
    {
      provider: 'openai',
      label: LABELS.openai,
      model: c.openaiModel || DEFAULT_MODELS.openai,
      requiresKey: true,
      hasKey: !!c.openaiApiKey,
      available: !!c.openaiApiKey,
      note: 'HTML/CSS oder React/Tailwind. Ohne API-Key nur manueller Export.'
    },
    {
      provider: 'ollama',
      label: LABELS.ollama,
      model: c.ollamaModel || DEFAULT_MODELS.ollama,
      baseUrl: c.ollamaBaseUrl,
      requiresKey: false,
      hasKey: true,
      available: true,
      note: 'Lokal & kostenlos. Lokale Modelle können schwächere Designs erzeugen als spezialisierte UI-KIs.'
    },
    {
      provider: 'manual',
      label: LABELS.manual,
      requiresKey: false,
      hasKey: true,
      available: true,
      note: 'Immer verfügbar. Erzeugt einen fertigen Prompt zum Kopieren für Claude Code, Lovable, v0 oder Cursor.'
    }
  ]
  return cfg
}

/** Standard-Provider (aus DEFAULT_AI_PREVIEW_PROVIDER, fällt auf „manual“ zurück). */
export function getDefaultProvider(): AIPreviewProvider {
  const c = loadConfig()
  const d = (c.defaultAiPreviewProvider || 'manual').toLowerCase()
  const valid: AIPreviewProvider[] = ['v0', 'claude', 'openai', 'ollama', 'manual']
  return (valid.includes(d as AIPreviewProvider) ? d : 'manual') as AIPreviewProvider
}

export function getProviderStatus(): ProviderStatus {
  return { default: getDefaultProvider(), providers: getProviderConfigs() }
}

/**
 * ÖFFENTLICHER Provider-Status – enthält NIEMALS Secrets/Keys.
 * Nur: verfügbar, Key vorhanden (ja/nein), Modellname. Für Frontend/Settings-Anzeige.
 */
export function getPublicProviderStatus(): ProviderStatus {
  return getProviderStatus()
}

export function getProviderConfig(provider: AIPreviewProvider): ProviderConfig {
  return getProviderConfigs().find((p) => p.provider === provider) || getProviderConfigs().find((p) => p.provider === 'manual')!
}

/**
 * Maskiert ein Secret. Zeigt NIE den vollständigen Key.
 * Standard: nur „Key vorhanden“ (bzw. „“ wenn keiner). Für Anzeige/Logs.
 */
export function maskSecret(secret?: string): string {
  return secret && secret.length > 0 ? 'Key vorhanden' : ''
}

/** SERVER-ONLY: Provider-Konfiguration INKL. Key. Niemals an den Client/an Routen-Antworten geben! */
export interface ServerProviderConfig {
  provider: AIPreviewProvider
  model?: string
  baseUrl?: string
  /** SERVER-ONLY – nur für den serverseitigen Provider-Aufruf. */
  apiKey?: string
  requiresKey: boolean
}

/** SERVER-ONLY: liefert die Provider-Config inkl. Key aus sicherer Quelle (env/.env.local/Settings). */
export function getServerProviderConfig(provider: AIPreviewProvider): ServerProviderConfig {
  const c = loadConfig(true)
  switch (provider) {
    case 'v0':
      return { provider, model: c.v0Model || DEFAULT_MODELS.v0, apiKey: c.v0ApiKey, requiresKey: true }
    case 'claude':
      return { provider, model: c.claudeModel || DEFAULT_MODELS.claude, apiKey: c.claudeApiKey, requiresKey: true }
    case 'openai':
      return { provider, model: c.openaiModel || DEFAULT_MODELS.openai, apiKey: c.openaiApiKey, requiresKey: true }
    case 'ollama':
      return { provider, model: c.ollamaModel || DEFAULT_MODELS.ollama, baseUrl: c.ollamaBaseUrl, requiresKey: false }
    default:
      return { provider: 'manual', requiresKey: false }
  }
}

export type ProviderCheckStatus = 'ok' | 'missing-key' | 'not-configured' | 'unreachable' | 'invalid-key' | 'manual' | 'error'
export interface ProviderCheckResult {
  provider: AIPreviewProvider
  ok: boolean
  status: ProviderCheckStatus
  message: string
}

/** Config-Prüfung (synchron, ohne Live-Aufruf): Key gefunden / Key fehlt / nicht konfiguriert. */
export function validateProviderConfig(provider: AIPreviewProvider): ProviderCheckResult {
  if (provider === 'manual') return { provider, ok: true, status: 'manual', message: 'Manueller Export – kein API-Key nötig.' }
  const valid: AIPreviewProvider[] = ['v0', 'claude', 'openai', 'ollama']
  if (!valid.includes(provider)) return { provider, ok: false, status: 'not-configured', message: 'Provider nicht konfiguriert.' }
  const s = getServerProviderConfig(provider)
  if (provider === 'ollama') return { provider, ok: true, status: 'ok', message: `Lokaler Provider – Erreichbarkeit per „Provider testen“ prüfen (${s.baseUrl}).` }
  return s.apiKey
    ? { provider, ok: true, status: 'ok', message: 'Key gefunden.' }
    : { provider, ok: false, status: 'missing-key', message: 'Key fehlt.' }
}

/**
 * Live-Test des Providers: minimale Server-Anfrage. Gibt NUR Erfolg/Fehler zurück,
 * NIEMALS den Key oder rohe sensible Antwortdaten. Für Cloud-Provider wird ein
 * kosten-neutraler /models-Endpoint genutzt (kein Token-Verbrauch).
 */
export async function testProvider(provider: AIPreviewProvider): Promise<ProviderCheckResult> {
  if (provider === 'manual') return { provider, ok: true, status: 'manual', message: 'Manueller Export ist immer verfügbar.' }
  const s = getServerProviderConfig(provider)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 12000)
  try {
    if (provider === 'ollama') {
      const r = await fetch(`${s.baseUrl}/api/tags`, { signal: ac.signal })
      if (!r.ok) return { provider, ok: false, status: 'unreachable', message: 'Ollama ist nicht erreichbar. Bitte Ollama starten oder anderen Provider wählen.' }
      return { provider, ok: true, status: 'ok', message: `Ollama erreichbar (${s.baseUrl}).` }
    }
    if (!s.apiKey) return { provider, ok: false, status: 'missing-key', message: 'Kein API-Key hinterlegt. Du kannst den Prompt manuell kopieren.' }
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${s.apiKey}` }, signal: ac.signal })
      if (r.status === 401) return { provider, ok: false, status: 'invalid-key', message: 'OpenAI: API-Key ungültig (401).' }
      if (!r.ok) return { provider, ok: false, status: 'error', message: `OpenAI-Test fehlgeschlagen (HTTP ${r.status}).` }
      return { provider, ok: true, status: 'ok', message: 'OpenAI erreichbar, Key gültig.' }
    }
    if (provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01' }, signal: ac.signal })
      if (r.status === 401) return { provider, ok: false, status: 'invalid-key', message: 'Claude: API-Key ungültig (401).' }
      if (!r.ok) return { provider, ok: false, status: 'error', message: `Claude-Test fehlgeschlagen (HTTP ${r.status}).` }
      return { provider, ok: true, status: 'ok', message: 'Claude erreichbar, Key gültig.' }
    }
    if (provider === 'v0') {
      const r = await fetch('https://api.v0.dev/v1/models', { headers: { authorization: `Bearer ${s.apiKey}` }, signal: ac.signal })
      if (r.status === 401 || r.status === 403) return { provider, ok: false, status: 'invalid-key', message: 'v0: API-Key ungültig.' }
      if (!r.ok) return { provider, ok: true, status: 'ok', message: 'v0: Key vorhanden (Test-Endpoint nicht verifizierbar, wird beim Generieren geprüft).' }
      return { provider, ok: true, status: 'ok', message: 'v0 erreichbar, Key gültig.' }
    }
    return { provider, ok: false, status: 'not-configured', message: 'Provider nicht konfiguriert.' }
  } catch (e) {
    // WICHTIG: niemals den Key oder Header in die Meldung aufnehmen – nur generischer Grund.
    const aborted = e instanceof Error && e.name === 'AbortError'
    if (provider === 'ollama') return { provider, ok: false, status: 'unreachable', message: 'Ollama ist nicht erreichbar. Bitte Ollama starten oder anderen Provider wählen.' }
    return { provider, ok: false, status: 'error', message: `Provider-Test fehlgeschlagen (${aborted ? 'Zeitüberschreitung' : 'nicht erreichbar'}).` }
  } finally {
    clearTimeout(timer)
  }
}
