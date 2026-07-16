import type { AIPreviewRequest, AIPreviewResult, AIPreviewPrompt, AIPreviewProvider } from '@shared/types'
import { buildAIPreviewPrompt, buildCorrectionPrompt, isPromptFormat, customerImageUrls } from './aiPreviewPromptBuilder'
import { extractCode, validateGeneratedCode, type ValidatorContext } from './aiPreviewCodeValidator'
import { buildGeneratedCode } from './aiPreviewRenderer'
import { buildManualExport, targetFromFormat } from './manualPromptExportService'
import { getProviderConfig, getServerProviderConfig } from './aiProviderSettings'
import { log } from '../utils/logger'

const TIMEOUT_MS = { cloud: 90000, ollama: 120000 }

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  return { signal: ac.signal, done: () => clearTimeout(t) }
}

/**
 * Ruft einen Provider auf; wirft mit klarer Meldung. Gibt den rohen Antworttext zurück.
 * Der API-Key kommt AUSSCHLIESSLICH aus der server-only `getServerProviderConfig` und
 * verlässt niemals den Server (nur im Request-Header an den Provider).
 */
async function callProvider(provider: AIPreviewProvider, prompt: { system: string; user: string }): Promise<string> {
  const cfg = getServerProviderConfig(provider)

  if (provider === 'v0') {
    if (!cfg.apiKey) throw new Error('NO_KEY')
    const to = withTimeout(TIMEOUT_MS.cloud)
    try {
      const res = await fetch('https://api.v0.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model || 'v0-1.5-md',
          messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }]
        }),
        signal: to.signal
      })
      if (res.status === 401 || res.status === 403) throw new Error('Ungültiger v0-API-Key.')
      if (res.status === 429) throw new Error('v0-Rate-Limit erreicht. Bitte später erneut versuchen.')
      if (!res.ok) throw new Error(`v0-Fehler ${res.status}`)
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const out = data.choices?.[0]?.message?.content
      if (!out) throw new Error('v0 lieferte keinen Code.')
      return out
    } finally {
      to.done()
    }
  }

  if (provider === 'claude') {
    if (!cfg.apiKey) throw new Error('NO_KEY')
    const to = withTimeout(TIMEOUT_MS.cloud)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: cfg.model || 'claude-opus-4-8',
          max_tokens: 8000,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }]
        }),
        signal: to.signal
      })
      if (res.status === 401) throw new Error('Ungültiger Claude-API-Key.')
      if (res.status === 429) throw new Error('Claude-Rate-Limit erreicht. Bitte später erneut versuchen.')
      if (!res.ok) throw new Error(`Claude-Fehler ${res.status}`)
      const data = (await res.json()) as { content?: { text?: string }[] }
      const out = data.content?.map((b) => b.text || '').join('')
      if (!out) throw new Error('Claude lieferte keinen Code.')
      return out
    } finally {
      to.done()
    }
  }

  if (provider === 'openai') {
    if (!cfg.apiKey) throw new Error('NO_KEY')
    const to = withTimeout(TIMEOUT_MS.cloud)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model || 'gpt-4o-mini',
          max_tokens: 6000,
          messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }]
        }),
        signal: to.signal
      })
      if (res.status === 401) throw new Error('Ungültiger OpenAI-API-Key.')
      if (res.status === 429) throw new Error('OpenAI-Rate-Limit erreicht. Bitte später erneut versuchen.')
      if (!res.ok) throw new Error(`OpenAI-Fehler ${res.status}`)
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const out = data.choices?.[0]?.message?.content
      if (!out) throw new Error('OpenAI lieferte keinen Code.')
      return out
    } finally {
      to.done()
    }
  }

  if (provider === 'ollama') {
    const base = cfg.baseUrl || 'http://localhost:11434'
    const to = withTimeout(TIMEOUT_MS.ollama)
    try {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: cfg.model || 'llama3.1',
          stream: false,
          messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }]
        }),
        signal: to.signal
      })
      if (!res.ok) throw new Error(`Ollama-Fehler ${res.status} (Modell „${cfg.model || 'llama3.1'}“ installiert?)`)
      const data = (await res.json()) as { message?: { content?: string } }
      const out = data.message?.content
      if (!out) throw new Error('Ollama lieferte keinen Code.')
      return out
    } catch (e) {
      if (e instanceof Error && (e.name === 'AbortError' || /fetch failed|ECONNREFUSED|network/i.test(e.message)))
        throw new Error('Ollama ist nicht erreichbar. Bitte Ollama starten oder anderen Provider wählen.')
      throw e
    } finally {
      to.done()
    }
  }

  throw new Error(`Unbekannter Provider: ${provider}`)
}

/** Baut den Validator-Kontext aus der Anfrage. */
function buildContext(req: AIPreviewRequest): ValidatorContext {
  const r = req.result
  const mainCta = r.concept.sections.find((s) => s.type === 'contact')?.ctaLabel || (r.referenceBlueprint?.reservationCta ? 'Tisch reservieren' : 'Kontakt')
  return {
    palette: r.concept.palette,
    referenceColors: req.inspiration.colors || [],
    hasLogo: !!req.source.logoDataUrl,
    companyName: r.concept.companyName || req.source.name || '',
    mainCta,
    blueprint: r.referenceBlueprint,
    customerImageUrls: customerImageUrls(r, req.source),
    referenceUrl: req.inspiration.url
  }
}

/**
 * Erzeugt die KI-Vorschau: baut Prompt, ruft Provider, extrahiert Code, validiert,
 * und macht bei Bedarf bis zu `maxCorrections` (Standard 2) Korrekturrunden.
 * Ohne API-Key oder bei „manual“/Prompt-Format → immer der manuelle Prompt-Export (funktioniert garantiert).
 */
export async function generateAIPreview(req: AIPreviewRequest): Promise<AIPreviewResult> {
  const provider = req.provider
  const format = req.format
  const maxCorrections = Math.min(Math.max(req.maxCorrections ?? 2, 0), 2)
  const createdAt = new Date().toISOString()
  const prompt: AIPreviewPrompt = buildAIPreviewPrompt({
    source: req.source,
    inspiration: req.inspiration,
    result: req.result,
    format,
    provider,
    customUser: req.customPrompt
  })

  const manualResult = (notes: string[], usedProvider: AIPreviewProvider = 'manual'): AIPreviewResult => ({
    mode: 'manual',
    provider,
    providerUsed: usedProvider,
    format,
    prompt,
    manualExport: buildManualExport(prompt, targetFromFormat(format)),
    corrections: 0,
    correctionPrompts: [],
    createdAt,
    notes
  })

  // Manuell oder Prompt-Zielformat → immer manueller Export
  if (provider === 'manual' || isPromptFormat(format)) {
    return manualResult(
      provider === 'manual'
        ? ['Manueller Modus: Prompt zum Kopieren/Einfügen in eine externe KI erzeugt.']
        : ['Prompt-Zielformat gewählt: fertiger Prompt zum Kopieren erzeugt (keine Code-Generierung).']
    )
  }

  // Provider braucht Key, hat aber keinen → sauberer manueller Fallback (kein Absturz)
  const pcfg = getProviderConfig(provider)
  if (pcfg.requiresKey && !pcfg.hasKey) {
    return manualResult([
      `Kein API-Key für ${pcfg.label} hinterlegt. Es wurde ein manueller Prompt-Export erstellt.`,
      'API-Key optional in der .env setzen (z. B. V0_API_KEY / CLAUDE_API_KEY / OPENAI_API_KEY) und Server neu starten.'
    ])
  }

  const ctx = buildContext(req)
  const notes: string[] = []
  const correctionPrompts: string[] = []
  let corrections = 0
  let currentUser = prompt.user
  let lastRaw = ''

  try {
    for (let attempt = 0; attempt <= maxCorrections; attempt++) {
      const raw = await callProvider(provider, { system: prompt.system, user: currentUser })
      lastRaw = raw
      const { code, language } = extractCode(raw, format)
      const validation = validateGeneratedCode(code, ctx)
      const generated = buildGeneratedCode(code, language, format)

      if (validation.passed || attempt === maxCorrections) {
        if (!validation.passed) notes.push(`Nach ${attempt} Korrektur(en) noch Abweichungen: ${validation.failures.join(', ')}.`)
        return {
          mode: 'ai',
          provider,
          providerUsed: provider,
          format,
          prompt,
          code: generated,
          validation,
          corrections,
          correctionPrompts,
          createdAt,
          notes
        }
      }
      // Korrekturrunde vorbereiten
      corrections++
      const corr = buildCorrectionPrompt(validation, ctx.palette, ctx.blueprint, ctx.customerImageUrls)
      correctionPrompts.push(corr)
      currentUser = `${prompt.user}\n\n---\n${corr}\n\n(Vorheriger Code zur Korrektur:)\n${code.slice(0, 4000)}`
      log.info(`KI-Vorschau: Korrekturrunde ${corrections} (${provider}), Abweichungen: ${validation.failures.join(', ')}`)
    }
    // theoretisch unerreichbar
    return manualResult(['Unerwarteter Abbruch der Generierung.'], provider)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Bei fehlendem Key oder Provider-Fehler: manuellen Export als sicheren Fallback liefern
    const fallback = manualResult(
      msg === 'NO_KEY'
        ? [`Kein API-Key für ${pcfg.label}. Manueller Prompt-Export erstellt.`]
        : [`Provider-Fehler (${pcfg.label}): ${msg}. Manueller Prompt-Export als Fallback erstellt.`],
      'manual'
    )
    fallback.error = msg === 'NO_KEY' ? undefined : msg
    if (lastRaw) fallback.notes.push('Es kam eine Antwort, aber sie war unbrauchbar/ungültig.')
    return fallback
  }
}
