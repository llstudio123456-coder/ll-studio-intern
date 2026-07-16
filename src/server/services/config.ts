import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { settingsFile } from '../utils/paths'
import { log } from '../utils/logger'

export interface AppConfig {
  // KI (optional)
  aiProvider?: 'anthropic' | 'openai' | 'ollama' | string
  aiApiKey?: string
  aiModel?: string
  aiBaseUrl?: string
  ollamaBaseUrl: string
  // KI-Vorschau-Provider (alle optional; „manual“ funktioniert immer)
  v0ApiKey?: string
  v0Model?: string
  claudeApiKey?: string
  claudeModel?: string
  openaiApiKey?: string
  openaiModel?: string
  ollamaModel?: string
  defaultAiPreviewProvider?: string
  // Suche (alles optional – ohne Keys läuft lokale Browser-Suche)
  searchProvider?: string // 'auto' | 'brave' | 'serpapi' | 'tavily' | 'local'
  braveApiKey?: string
  serpApiKey?: string
  tavilyApiKey?: string
  // Allgemein
  maxResults: number
  defaultCountry: string
  headless: boolean
}

/** Schlüssel, die über die Settings-UI gespeichert werden dürfen. */
export type SettingsPatch = Partial<
  Pick<
    AppConfig,
    | 'aiProvider'
    | 'aiApiKey'
    | 'aiModel'
    | 'aiBaseUrl'
    | 'v0ApiKey'
    | 'v0Model'
    | 'claudeApiKey'
    | 'claudeModel'
    | 'openaiApiKey'
    | 'openaiModel'
    | 'ollamaBaseUrl'
    | 'ollamaModel'
    | 'defaultAiPreviewProvider'
    | 'searchProvider'
    | 'braveApiKey'
    | 'serpApiKey'
    | 'tavilyApiKey'
    | 'maxResults'
    | 'defaultCountry'
  >
>

/**
 * Mapping AppConfig-Feldname → kanonischer ENV-Variablenname.
 * WICHTIG: Settings werden unter dem ENV-Namen gespeichert, damit `loadConfig` (das
 * ausschließlich ENV-Namen liest) die gespeicherten Werte auch wieder findet.
 */
const FIELD_TO_ENV: Record<string, string> = {
  aiProvider: 'AI_PROVIDER',
  aiApiKey: 'AI_API_KEY',
  aiModel: 'AI_MODEL',
  aiBaseUrl: 'AI_BASE_URL',
  v0ApiKey: 'V0_API_KEY',
  v0Model: 'V0_MODEL',
  claudeApiKey: 'CLAUDE_API_KEY',
  claudeModel: 'CLAUDE_MODEL',
  openaiApiKey: 'OPENAI_API_KEY',
  openaiModel: 'OPENAI_MODEL',
  ollamaBaseUrl: 'OLLAMA_BASE_URL',
  ollamaModel: 'OLLAMA_MODEL',
  defaultAiPreviewProvider: 'DEFAULT_AI_PREVIEW_PROVIDER',
  searchProvider: 'SEARCH_PROVIDER',
  braveApiKey: 'BRAVE_API_KEY',
  serpApiKey: 'SERPAPI_KEY',
  tavilyApiKey: 'TAVILY_API_KEY',
  maxResults: 'MAX_RESULTS',
  defaultCountry: 'DEFAULT_COUNTRY'
}

const MASK = '••••••••'

/** Sehr einfacher .env-Parser (keine Abhängigkeit nötig). */
function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function readOne(file: string): Record<string, string> {
  const path = join(process.cwd(), file)
  if (!existsSync(path)) return {}
  try {
    return parseEnv(readFileSync(path, 'utf-8'))
  } catch {
    return {}
  }
}

/** Liest Secrets/Config aus Dateien. `.env.local` hat Vorrang vor `.env` (Next.js-Konvention). */
function readEnvFile(): Record<string, string> {
  // .env.local überschreibt .env (aber process.env hat in loadConfig Vorrang vor beidem)
  return { ...readOne('.env'), ...readOne('.env.local') }
}

/** In der UI gespeicherte Settings (überschreiben .env nicht, ergänzen sie). */
function readSettings(): Record<string, string> {
  try {
    const p = settingsFile()
    if (!existsSync(p)) return {}
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

export function saveSettings(patch: SettingsPatch): void {
  const current = readSettings()
  const merged: Record<string, unknown> = { ...current }
  for (const [k, v] of Object.entries(patch)) {
    const envKey = FIELD_TO_ENV[k] || k
    // Alt-Format (unter Feldnamen gespeichert) bereinigen, damit nichts doppelt liegt
    if (FIELD_TO_ENV[k] && k in merged) delete merged[k]
    // Maskierten Platzhalter NIE als echten Key speichern
    if (typeof v === 'string' && v === MASK) continue
    // Leeres/entferntes Feld → Key löschen (explizite Aktion, z. B. „Key entfernen“)
    if (v === '' || v === undefined || v === null) delete merged[envKey]
    else merged[envKey] = v
  }
  writeFileSync(settingsFile(), JSON.stringify(merged, null, 2), 'utf-8')
  cached = null
  // WICHTIG: niemals Key-Werte loggen.
  log.info('Settings gespeichert.')
}

let cached: AppConfig | null = null

export function loadConfig(force = false): AppConfig {
  if (cached && !force) return cached
  const fileEnv = readEnvFile()
  const settings = readSettings()
  // Priorität: Prozess-Env > .env(.local) > gespeicherte Settings.
  // WICHTIG: LEERE Werte (z. B. Platzhalter `OPENAI_API_KEY=` in .env.local) gelten als
  // „nicht gesetzt“ und fallen zur nächsten Quelle durch (sonst würde ein leerer String
  // den Settings-Fallback überschatten – `??` fällt nur bei null/undefined durch, nicht bei '').
  const pick = (...vals: (string | undefined)[]) => {
    for (const v of vals) if (v != null && v !== '') return v
    return ''
  }
  const get = (k: string) => pick(process.env[k], fileEnv[k], settings[k] as string)

  cached = {
    aiProvider: get('AI_PROVIDER') || undefined,
    aiApiKey: get('AI_API_KEY') || undefined,
    aiModel: get('AI_MODEL') || undefined,
    aiBaseUrl: get('AI_BASE_URL') || undefined,
    ollamaBaseUrl: get('OLLAMA_BASE_URL') || 'http://localhost:11434',
    v0ApiKey: get('V0_API_KEY') || undefined,
    v0Model: get('V0_MODEL') || undefined,
    claudeApiKey: get('CLAUDE_API_KEY') || undefined,
    claudeModel: get('CLAUDE_MODEL') || undefined,
    openaiApiKey: get('OPENAI_API_KEY') || undefined,
    openaiModel: get('OPENAI_MODEL') || undefined,
    ollamaModel: get('OLLAMA_MODEL') || undefined,
    defaultAiPreviewProvider: get('DEFAULT_AI_PREVIEW_PROVIDER') || 'manual',
    searchProvider: get('SEARCH_PROVIDER') || 'auto',
    braveApiKey: get('BRAVE_API_KEY') || undefined,
    serpApiKey: get('SERPAPI_KEY') || undefined,
    tavilyApiKey: get('TAVILY_API_KEY') || undefined,
    maxResults: Number(get('MAX_RESULTS')) || 20,
    defaultCountry: get('DEFAULT_COUNTRY') || 'Germany',
    headless: get('HEADLESS') !== 'false'
  }
  return cached
}

/** Maskierte Settings-Ansicht für die UI (zeigt NUR, ob ein Key gesetzt ist – NIE den Key selbst). */
export function settingsView() {
  const c = loadConfig(true)
  return {
    aiProvider: c.aiProvider || '',
    aiModel: c.aiModel || '',
    aiBaseUrl: c.aiBaseUrl || '',
    aiApiKeySet: !!c.aiApiKey,
    // KI-Vorschau-Provider (Modelle/Base-URL sind kein Secret; Keys nur als Boolean)
    v0Model: c.v0Model || '',
    v0ApiKeySet: !!c.v0ApiKey,
    claudeModel: c.claudeModel || '',
    claudeApiKeySet: !!c.claudeApiKey,
    openaiModel: c.openaiModel || '',
    openaiApiKeySet: !!c.openaiApiKey,
    ollamaBaseUrl: c.ollamaBaseUrl || '',
    ollamaModel: c.ollamaModel || '',
    defaultAiPreviewProvider: c.defaultAiPreviewProvider || 'manual',
    searchProvider: c.searchProvider || 'auto',
    braveApiKeySet: !!c.braveApiKey,
    serpApiKeySet: !!c.serpApiKey,
    tavilyApiKeySet: !!c.tavilyApiKey,
    maxResults: c.maxResults,
    defaultCountry: c.defaultCountry
  }
}
