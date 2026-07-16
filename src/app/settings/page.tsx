'use client'
import { useEffect, useState } from 'react'
import { Save, Check, KeyRound, Sparkles, Search, Wand2, Trash2, Settings as SettingsIcon } from 'lucide-react'
import { PageHeader, InfoBanner, SkeletonRows } from '@/components/ui/Ui'
import { getJson } from '@/lib/client'

interface SettingsView {
  aiProvider: string
  aiModel: string
  aiBaseUrl: string
  aiApiKeySet: boolean
  v0Model: string
  v0ApiKeySet: boolean
  claudeModel: string
  claudeApiKeySet: boolean
  openaiModel: string
  openaiApiKeySet: boolean
  ollamaBaseUrl: string
  ollamaModel: string
  defaultAiPreviewProvider: string
  searchProvider: string
  braveApiKeySet: boolean
  serpApiKeySet: boolean
  tavilyApiKeySet: boolean
  maxResults: number
  defaultCountry: string
}

const EMPTY_KEYS = { aiApiKey: '', v0ApiKey: '', claudeApiKey: '', openaiApiKey: '', braveApiKey: '', serpApiKey: '', tavilyApiKey: '' }

export default function SettingsPage() {
  const [v, setV] = useState<SettingsView | null>(null)
  const [saved, setSaved] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [testMsg, setTestMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  // Felder, die NUR bei Eingabe gesendet werden (Keys):
  const [keys, setKeys] = useState({ ...EMPTY_KEYS })
  const [form, setForm] = useState({
    aiProvider: '', aiModel: '', aiBaseUrl: '',
    defaultAiPreviewProvider: 'manual', v0Model: '', claudeModel: '', openaiModel: '', ollamaBaseUrl: '', ollamaModel: '',
    searchProvider: 'auto', maxResults: 20, defaultCountry: 'Germany'
  })

  const applyView = (s: SettingsView) => {
    setV(s)
    setForm({
      aiProvider: s.aiProvider, aiModel: s.aiModel, aiBaseUrl: s.aiBaseUrl,
      defaultAiPreviewProvider: s.defaultAiPreviewProvider || 'manual', v0Model: s.v0Model || '', claudeModel: s.claudeModel || '',
      openaiModel: s.openaiModel || '', ollamaBaseUrl: s.ollamaBaseUrl || '', ollamaModel: s.ollamaModel || '',
      searchProvider: s.searchProvider || 'auto', maxResults: s.maxResults, defaultCountry: s.defaultCountry
    })
  }

  useEffect(() => {
    getJson<SettingsView>('/api/settings').then(applyView)
  }, [])

  const save = async () => {
    const patch: Record<string, unknown> = { ...form }
    for (const [k, val] of Object.entries(keys)) if (val.trim()) patch[k] = val.trim() // leere Felder werden NICHT gesendet → bestehender Key bleibt erhalten
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    const next = (await res.json()) as SettingsView
    applyView(next)
    setKeys({ ...EMPTY_KEYS })
    const anyKey = next.v0ApiKeySet || next.claudeApiKeySet || next.openaiApiKeySet || next.aiApiKeySet
    setSavedMsg(anyKey ? 'Gespeichert · Key vorhanden' : 'Gespeichert · Kein Key gesetzt')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // Expliziter Key-Entfernen (sendet null → Server löscht den Key)
  const removeKey = async (field: string) => {
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [field]: null }) })
    applyView((await res.json()) as SettingsView)
    setSavedMsg('Key entfernt')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Provider testen (nutzt gespeicherten/​env-Key serverseitig; zeigt nur Erfolg/Fehler)
  const testProvider = async (provider: string) => {
    setTestMsg((m) => ({ ...m, [provider]: { ok: false, text: 'teste …' } }))
    try {
      const r = await fetch('/api/ai-preview/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider }) })
      const d = await r.json()
      const res = d.result || {}
      setTestMsg((m) => ({ ...m, [provider]: { ok: !!res.ok, text: res.message || d.error || 'Test fehlgeschlagen' } }))
    } catch {
      setTestMsg((m) => ({ ...m, [provider]: { ok: false, text: 'Test fehlgeschlagen (Netzwerk).' } }))
    }
  }

  if (!v)
    return (
      <div className="mx-auto max-w-[1100px] space-y-5">
        <PageHeader eyebrow="System" icon={SettingsIcon} title="Settings" subtitle="Einstellungen werden geladen …" />
        <SkeletonRows rows={6} />
      </div>
    )

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader
        eyebrow="System"
        icon={SettingsIcon}
        title="Settings"
        subtitle="Alle Keys sind optional. Ohne Keys läuft die Recherche lokal über den Browser und alle Bewertungen regelbasiert."
      />
      <InfoBanner>
        API-Schlüssel werden ausschließlich serverseitig verwendet, niemals im Frontend angezeigt und nicht ins Repository committet. Leeres Key-Feld = bestehender Key bleibt erhalten.
      </InfoBanner>

      <div className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl"><Sparkles size={17} className="text-[var(--color-gold)]" /> KI (optional)</h2>
        <Row label="Provider">
          <select value={form.aiProvider} onChange={(e) => setForm({ ...form, aiProvider: e.target.value })} className="inp">
            <option value="">keine KI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI-kompatibel</option>
            <option value="ollama">Ollama (lokal)</option>
          </select>
        </Row>
        <Row label="Modell"><input className="inp" placeholder="z. B. claude-opus-4-8 / gpt-4o-mini / llama3.1" value={form.aiModel} onChange={(e) => setForm({ ...form, aiModel: e.target.value })} /></Row>
        <Row label="Base-URL (nur OpenAI-kompatibel)"><input className="inp" placeholder="https://api.openai.com/v1" value={form.aiBaseUrl} onChange={(e) => setForm({ ...form, aiBaseUrl: e.target.value })} /></Row>
        <Row label="API-Key"><KeyInput set={v.aiApiKeySet} value={keys.aiApiKey} onChange={(val) => setKeys({ ...keys, aiApiKey: val })} /></Row>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl"><Wand2 size={17} className="text-[var(--color-gold)]" /> KI-Vorschau-Provider (optional)</h2>
        <p className="text-xs text-[var(--color-muted)]">
          Für „KI-Vorschau generieren“. Priorität: Server-Env &gt; .env.local &gt; .env &gt; diese Settings. Ohne Key funktioniert immer der manuelle Prompt-Export. Keys werden nur serverseitig genutzt und nie angezeigt.
        </p>
        <Row label="Standard-Provider">
          <select value={form.defaultAiPreviewProvider} onChange={(e) => setForm({ ...form, defaultAiPreviewProvider: e.target.value })} className="inp">
            <option value="manual">Manuell (kein Key)</option>
            <option value="openai">OpenAI</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="v0">v0 (Vercel)</option>
            <option value="ollama">Ollama (lokal)</option>
          </select>
        </Row>
        <ProviderKeyBlock label="OpenAI" providerId="openai" set={v.openaiApiKeySet} modelPlaceholder="gpt-4o-mini"
          model={form.openaiModel} onModel={(x) => setForm({ ...form, openaiModel: x })}
          keyVal={keys.openaiApiKey} onKey={(x) => setKeys({ ...keys, openaiApiKey: x })}
          onRemove={() => removeKey('openaiApiKey')} onTest={() => testProvider('openai')} test={testMsg.openai} />
        <ProviderKeyBlock label="Claude (Anthropic)" providerId="claude" set={v.claudeApiKeySet} modelPlaceholder="claude-opus-4-8"
          model={form.claudeModel} onModel={(x) => setForm({ ...form, claudeModel: x })}
          keyVal={keys.claudeApiKey} onKey={(x) => setKeys({ ...keys, claudeApiKey: x })}
          onRemove={() => removeKey('claudeApiKey')} onTest={() => testProvider('claude')} test={testMsg.claude} />
        <ProviderKeyBlock label="v0 (Vercel)" providerId="v0" set={v.v0ApiKeySet} modelPlaceholder="v0-1.5-md"
          model={form.v0Model} onModel={(x) => setForm({ ...form, v0Model: x })}
          keyVal={keys.v0ApiKey} onKey={(x) => setKeys({ ...keys, v0ApiKey: x })}
          onRemove={() => removeKey('v0ApiKey')} onTest={() => testProvider('v0')} test={testMsg.v0} />
        <div className="rounded-lg border border-[var(--color-line)] p-3">
          <div className="text-sm font-medium">Ollama (lokal · kein API-Key nötig)</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input className="inp" placeholder="http://localhost:11434" value={form.ollamaBaseUrl} onChange={(e) => setForm({ ...form, ollamaBaseUrl: e.target.value })} />
            <input className="inp" placeholder="Modell z. B. llama3.1" value={form.ollamaModel} onChange={(e) => setForm({ ...form, ollamaModel: e.target.value })} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => testProvider('ollama')} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">Provider testen</button>
            {testMsg.ollama && <span className={testMsg.ollama.ok ? 'text-xs text-green-600' : 'text-xs text-amber-600'}>{testMsg.ollama.ok ? '✓ ' : '⚠ '}{testMsg.ollama.text}</span>}
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl"><Search size={17} className="text-[var(--color-gold)]" /> Suche (optional)</h2>
        <p className="text-xs text-[var(--color-muted)]">Leer / „auto“ = lokale Browser-Suche (Startpage/Bing/DuckDuckGo). Keys verbessern Treffer & Tempo.</p>
        <Row label="Such-Provider">
          <select value={form.searchProvider} onChange={(e) => setForm({ ...form, searchProvider: e.target.value })} className="inp">
            <option value="auto">auto (API falls vorhanden, sonst Browser)</option>
            <option value="local">nur lokaler Browser</option>
            <option value="brave">Brave</option>
            <option value="serpapi">SerpAPI</option>
            <option value="tavily">Tavily</option>
          </select>
        </Row>
        <Row label="Brave API-Key"><KeyInput set={v.braveApiKeySet} value={keys.braveApiKey} onChange={(val) => setKeys({ ...keys, braveApiKey: val })} /></Row>
        <Row label="SerpAPI Key"><KeyInput set={v.serpApiKeySet} value={keys.serpApiKey} onChange={(val) => setKeys({ ...keys, serpApiKey: val })} /></Row>
        <Row label="Tavily Key"><KeyInput set={v.tavilyApiKeySet} value={keys.tavilyApiKey} onChange={(val) => setKeys({ ...keys, tavilyApiKey: val })} /></Row>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="font-display text-xl">Allgemein</h2>
        <Row label="Max. Ergebnisse"><input className="inp" type="number" value={form.maxResults} onChange={(e) => setForm({ ...form, maxResults: Number(e.target.value) })} /></Row>
        <Row label="Standard-Land"><input className="inp" value={form.defaultCountry} onChange={(e) => setForm({ ...form, defaultCountry: e.target.value })} /></Row>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="btn-ink inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium">
          {saved ? <><Check size={16} /> Gespeichert</> : <><Save size={16} /> Speichern</>}
        </button>
        {saved && savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
      </div>
    </div>
  )
}

function ProviderKeyBlock({
  label, providerId, set, model, modelPlaceholder, keyVal, onModel, onKey, onRemove, onTest, test
}: {
  label: string
  providerId: string
  set: boolean
  model: string
  modelPlaceholder: string
  keyVal: string
  onModel: (v: string) => void
  onKey: (v: string) => void
  onRemove: () => void
  onTest: () => void
  test?: { ok: boolean; text: string }
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={set ? 'text-xs text-green-600' : 'text-xs text-[var(--color-muted)]'}>{set ? '● Key vorhanden' : '○ nicht gesetzt'}</span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input className="inp" placeholder={`Modell z. B. ${modelPlaceholder}`} value={model} onChange={(e) => onModel(e.target.value)} />
        <KeyInput set={set} value={keyVal} onChange={onKey} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={onTest} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">Provider testen</button>
        {set && <button onClick={onRemove} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"><Trash2 size={12} /> Key entfernen</button>}
        {test && <span className={test.ok ? 'text-xs text-green-600' : 'text-xs text-amber-600'}>{test.ok ? '✓ ' : '⚠ '}{test.text}</span>}
      </div>
      <p className="mt-1 text-[11px] text-[var(--color-muted)]">Leer lassen = bestehenden Key behalten. Zum Ändern neuen Key eingeben, zum Löschen „Key entfernen“. Provider-ID: {providerId}.</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</span>
      {children}
    </label>
  )
}

function KeyInput({ set, value, onChange }: { set: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <KeyRound size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]" />
      <input
        type="password"
        className="inp pl-9"
        placeholder={set ? '•••••••• (gesetzt — leer lassen zum Behalten)' : 'nicht gesetzt'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
