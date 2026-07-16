import type { AiStatus } from '@shared/types'
import { loadConfig } from './config'
import { log } from '../utils/logger'

/**
 * Optionale KI-Schicht. Vollständig optional – ohne Konfiguration passiert nichts.
 * Unterstützt: anthropic | openai (kompatibel) | ollama.
 * Nutzt globales fetch (Node 18+), keine zusätzlichen SDKs nötig.
 */

export function aiStatus(): AiStatus {
  const c = loadConfig()
  const provider = c.aiProvider
  if (!provider) return { configured: false }
  if (provider === 'ollama') {
    return { configured: true, provider, model: c.aiModel || 'llama3.1' }
  }
  return { configured: !!c.aiApiKey, provider, model: c.aiModel }
}

export function isAiConfigured(): boolean {
  return aiStatus().configured
}

/** Sendet einen Prompt an den konfigurierten Provider. Gibt null bei Fehler/keine KI. */
export async function aiComplete(system: string, user: string, maxTokens = 1200): Promise<string | null> {
  const c = loadConfig()
  const provider = c.aiProvider
  if (!provider) return null

  try {
    if (provider === 'anthropic') {
      if (!c.aiApiKey) return null
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': c.aiApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: c.aiModel || 'claude-opus-4-8',
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }]
        })
      })
      if (!res.ok) throw new Error(`Anthropic ${res.status}`)
      const data = (await res.json()) as { content?: { text?: string }[] }
      return data.content?.map((b) => b.text || '').join('') || null
    }

    if (provider === 'openai') {
      if (!c.aiApiKey) return null
      const base = c.aiBaseUrl || 'https://api.openai.com/v1'
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${c.aiApiKey}` },
        body: JSON.stringify({
          model: c.aiModel || 'gpt-4o-mini',
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      })
      if (!res.ok) throw new Error(`OpenAI ${res.status}`)
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      return data.choices?.[0]?.message?.content || null
    }

    if (provider === 'ollama') {
      const base = c.ollamaBaseUrl
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: c.aiModel || 'llama3.1',
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      })
      if (!res.ok) throw new Error(`Ollama ${res.status}`)
      const data = (await res.json()) as { message?: { content?: string } }
      return data.message?.content || null
    }
  } catch (e) {
    log.warn('KI-Aufruf fehlgeschlagen, nutze regelbasierten Fallback:', e)
    return null
  }
  return null
}

/** Prüft, ob die KI tatsächlich erreichbar ist (für Status-Anzeige). */
export async function pingAi(): Promise<AiStatus> {
  const status = aiStatus()
  if (!status.configured) return status
  const r = await aiComplete('Antworte mit OK.', 'ping', 20)
  return { ...status, reachable: !!r }
}
