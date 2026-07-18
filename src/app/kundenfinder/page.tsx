'use client'
import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, Save, Ban, ExternalLink, RefreshCw, Upload, Download, X, MapPin, Phone, Mail, Globe, ClipboardList, History as HistoryIcon, Layers, ShieldAlert, Copy, Pencil, Check, PhoneCall, UserSearch, Smartphone, ChevronDown, Star, AlertTriangle, ShieldCheck, SlidersHorizontal, ArrowRight, Info, BookmarkX
} from 'lucide-react'
import type { Company, LeadStatus, SearchParams, CompanyPerson, PersonContactStatus, DecisionRelevance } from '@shared/kundenfinder'
import {
  LEAD_STATUS_LABELS, EXCLUDING_STATUSES, DECISION_RELEVANCE_LABELS, PHONE_TYPE_LABELS,
  MOBILE_CONFIDENCE_LABELS, CONFIDENCE_LABELS, PERSON_CONTACT_STATUS_LABELS, BLOCKING_PERSON_STATUSES
} from '@shared/kundenfinder'
import { cls } from '@/lib/format'
import { useToast } from '@/lib/stores/toastStore'
import { StatusBadge, ScoreBadge, Metric } from '@/components/ui/Ui'
import { PhoneLink } from '@/components/PhoneLink'
import { telHref } from '@shared/phone'
import { WEBSITE_STATE_LABELS, WEBSITE_STATE_TONE, EMPTY_WEBSITE_STATES, type WebsiteState } from '@shared/websiteState'

const WS_TONE_CLS: Record<'green' | 'amber' | 'red' | 'gray', string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-[var(--color-paper-2)] text-[var(--color-muted)]'
}

/** Badge für den erkannten Website-Zustand (leer/geparkt/… vs. vorhanden). */
function WebsiteStateBadge({ state, manual }: { state: WebsiteState; manual?: boolean }) {
  return (
    <span className={cls('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', WS_TONE_CLS[WEBSITE_STATE_TONE[state]])}
      title={manual ? 'Manuell festgelegter Zustand' : 'Automatisch erkannt'}>
      {WEBSITE_STATE_LABELS[state]}{manual && <Pencil size={8} />}
    </span>
  )
}

const PRIO_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = { A: 'success', B: 'info', C: 'warning', D: 'neutral' }
const CONTACT: Record<string, { label: string; tone: 'success' | 'warning' | 'error' }> = {
  vollstaendig: { label: 'Kontakt vollständig', tone: 'success' },
  teilweise: { label: 'Teilweise', tone: 'warning' },
  keine: { label: 'Keine Kontaktdaten', tone: 'error' }
}
const REL_TONE: Record<DecisionRelevance, 'success' | 'info' | 'warning' | 'neutral'> = { sehr_hoch: 'success', hoch: 'info', mittel: 'warning', unbekannt: 'neutral' }
const REL_SHORT: Record<DecisionRelevance, string> = { sehr_hoch: 'Entscheider', hoch: 'Entscheidungsnah', mittel: 'Kontaktperson', unbekannt: 'Rolle unklar' }
const SORT_OPTS: [string, string][] = [
  ['prio', 'Akquise-Priorität'],
  ['website_bad', 'Schlechteste Website zuerst'],
  ['website_good', 'Beste Website zuerst'],
  ['lead_high', 'Höchster Lead-Score'],
  ['newest', 'Neueste zuerst'],
  ['name', 'Name A–Z'],
  ['city', 'Ort A–Z'],
  ['contact', 'Vollständigste Kontakte']
]

type Tab = 'uebersicht' | 'finden' | 'ergebnisse' | 'nachrecherche' | 'gespeichert' | 'pipeline' | 'ausschluss' | 'verlauf' | 'einstellungen'

const VIEW_META: Record<Tab, { title: string; crumb: string }> = {
  uebersicht: { title: 'Übersicht', crumb: 'Übersicht' },
  finden: { title: 'Unternehmen finden', crumb: 'Unternehmen finden' },
  ergebnisse: { title: 'Ergebnisse', crumb: 'Ergebnisse' },
  nachrecherche: { title: 'Nachrecherche', crumb: 'Nachrecherche' },
  gespeichert: { title: 'Gespeicherte Kunden', crumb: 'Gespeicherte Kunden' },
  pipeline: { title: 'Kontakt-Pipeline', crumb: 'Kontakt-Pipeline' },
  ausschluss: { title: 'Ausschlussliste', crumb: 'Ausschlussliste' },
  verlauf: { title: 'Suchverlauf', crumb: 'Suchverlauf' },
  einstellungen: { title: 'Import & Pflege', crumb: 'Import & Pflege' }
}

const INDUSTRIES = ['Restaurant', 'Café', 'Hotel', 'Friseur', 'Kosmetikstudio', 'Elektriker', 'Sanitär & Heizung', 'Dachdecker', 'Maler', 'Garten- & Landschaftsbau', 'Gebäudereinigung', 'Bauunternehmen', 'Autowerkstatt', 'Fahrschule', 'Immobilienmakler', 'Zahnarztpraxis', 'Arztpraxis', 'Physiotherapie', 'Fitnessstudio', 'Rechtsanwalt', 'Steuerberater', 'Pflegedienst', 'Logistikunternehmen', 'Einzelhandel']

const wsColor = (s?: number) => (s == null ? 'var(--color-muted)' : s >= 61 ? '#dc2626' : s >= 41 ? '#ea580c' : s >= 21 ? '#ca8a04' : '#16a34a')
const leadColor = (s?: number) => (s == null ? 'var(--color-muted)' : s >= 58 ? '#16a34a' : s >= 42 ? '#ca8a04' : '#6b7280')

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts)
  return r.json()
}

export default function KundenfinderPage() {
  return (
    <Suspense fallback={null}>
      <KundenfinderInner />
    </Suspense>
  )
}

function KundenfinderInner() {
  const router = useRouter()
  const params = useSearchParams()
  const view = ((params.get('view') as Tab) in VIEW_META ? (params.get('view') as Tab) : 'ergebnisse') as Tab
  const [detail, setDetail] = useState<Company | null>(null)
  // Ausgewähltes Unternehmen per ID (nicht per Listenindex — der ändert sich durch Sortierung/
  // Filter). Die Markierung bleibt bestehen, auch wenn die Detailansicht geschlossen wird oder
  // die Liste sich durch eine kleine Aktion neu lädt (Spezifikation §5–7).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const openDetail = useCallback((c: Company) => { setSelectedId(c.id); setDetail(c) }, [])
  // Nur auswählen (ohne Detail zu öffnen): für Klicks auf Website-Link, Telefon, E-Mail usw.
  // innerhalb einer Unternehmenszeile. So wird das Unternehmen markiert, ohne die Detailansicht
  // aufzureißen — und die Markierung überlebt das Öffnen des externen Links im neuen Tab.
  const selectCompany = useCallback((c: Company) => setSelectedId(c.id), [])
  const go = useCallback((v: Tab) => router.push(`/kundenfinder?view=${v}`, { scroll: false }), [router])

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <KfHeader view={view} onFind={() => go('finden')} />
      <LegalBar />

      {view === 'uebersicht' && <UebersichtTab go={go} />}
      {view === 'finden' && <FindenTab onDone={() => go('ergebnisse')} />}
      {view === 'ergebnisse' && <CompanyListTab key="erg" scope="ergebnisse" onDetail={openDetail} onSelect={selectCompany} selectedId={selectedId} />}
      {view === 'nachrecherche' && <CompanyListTab key="nach" scope="nachrecherche" onDetail={openDetail} onSelect={selectCompany} selectedId={selectedId} />}
      {view === 'gespeichert' && <CompanyListTab key="gesp" scope="gespeichert" onDetail={openDetail} onSelect={selectCompany} selectedId={selectedId} />}
      {view === 'pipeline' && <PipelineTab onDetail={openDetail} />}
      {view === 'ausschluss' && <CompanyListTab key="aus" scope="ausschluss" onDetail={openDetail} onSelect={selectCompany} selectedId={selectedId} />}
      {view === 'verlauf' && <VerlaufTab />}
      {view === 'einstellungen' && <EinstellungenTab />}

      {detail && <DetailDrawer id={detail.id} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ─────────── Kompakter Seitenkopf + Breadcrumb ─────────── */
function KfHeader({ view, onFind }: { view: Tab; onFind: () => void }) {
  const m = VIEW_META[view]
  const showFind = view !== 'finden' && view !== 'einstellungen' && view !== 'verlauf' && view !== 'uebersicht'
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-3">
      <div className="min-w-0">
        <nav className="mb-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          <span>Kundengewinnung</span><span aria-hidden>/</span><span>Kundenfinder</span><span aria-hidden>/</span>
          <span className="font-medium text-[var(--color-ink-soft)]">{m.crumb}</span>
        </nav>
        <h1 className="font-display text-[22px] leading-tight text-[var(--color-ink)]">{m.title}</h1>
      </div>
      {showFind && (
        <button onClick={onFind} className="btn-ink inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium">
          <Search size={15} /> Unternehmen finden
        </button>
      )}
    </header>
  )
}

/* ─────────── Schlanke, aufklappbare Rechtshinweis-Leiste ─────────── */
function LegalBar() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[12px] text-[var(--color-ink-soft)]">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <ShieldAlert size={14} className="shrink-0 text-[var(--color-gold)]" />
        <span className="min-w-0 flex-1 truncate">Vor einer Kontaktaufnahme wettbewerbs- und datenschutzrechtliche Anforderungen (u. a. § 7 UWG) prüfen.</span>
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-[11px] text-[var(--color-gold)] hover:underline">{open ? 'Weniger' : 'Details anzeigen'}</button>
      </div>
      {open && (
        <div className="border-t border-[var(--color-line)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
          Das System unterstützt Unternehmensrecherche und Kontaktverwaltung. Eine öffentlich veröffentlichte Nummer ist keine Einwilligung in Werbung; Telefonwerbung gegenüber Unternehmen setzt mindestens eine mutmaßliche Einwilligung voraus, E-Mail-Werbung ist strenger geregelt. Betroffene können jederzeit widersprechen. Keine automatische Massen-E-Mail-Funktion.
        </div>
      )}
    </div>
  )
}

/* ─────────── Übersicht (Kennzahlen + Schnellzugriff) ─────────── */
function UebersichtTab({ go }: { go: (v: Tab) => void }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  useEffect(() => { api<{ stats?: Record<string, number> }>('/api/kundenfinder/companies?stats=1&limit=1').then((d) => setStats(d.stats || null)) }, [])
  const s = stats || {}
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button onClick={() => go('ergebnisse')} className="text-left"><Metric label="Qualifizierte Leads" value={s.qualifiziert ?? '—'} hint="Telefon + E-Mail" icon={ClipboardList} /></button>
        <button onClick={() => go('nachrecherche')} className="text-left"><Metric label="Nachrecherche" value={s.nachrecherche ?? '—'} hint="unvollständige Kontakte" icon={Phone} /></button>
        <button onClick={() => go('ergebnisse')} className="text-left"><Metric label="Priorität A" value={s.prioA ?? '—'} hint="sofort prüfen" icon={Star} /></button>
        <button onClick={() => go('gespeichert')} className="text-left"><Metric label="Gespeicherte Kunden" value={s.gespeichert ?? '—'} hint="in Bearbeitung" icon={Save} /></button>
      </div>
      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold">Schnellzugriff</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => go('finden')} className="btn-ink inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><Search size={15} /> Unternehmen finden</button>
          <button onClick={() => go('ergebnisse')} className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><ClipboardList size={15} /> Ergebnisse <ArrowRight size={13} /></button>
          <button onClick={() => go('pipeline')} className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><Layers size={15} /> Kontakt-Pipeline <ArrowRight size={13} /></button>
          <button onClick={() => go('einstellungen')} className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><Upload size={15} /> CSV-Import</button>
        </div>
      </div>
      <p className="text-xs text-[var(--color-muted)]">Gesamt erfasst: <b>{s.gesamt ?? '—'}</b> Unternehmen · dauerhafter Dubletten-Schutz aktiv.</p>
    </div>
  )
}

/* ─────────── Unternehmen finden ─────────── */
function FindenTab({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState<SearchParams>({ industry: 'Restaurant', city: '', radiusKm: 10, maxResults: 60, analyzeWebsites: true })
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<{ area: string; found: number; neu: number; duplicates: number; excluded: number; possible: number; analyzed: number; errors: string[] } | null>(null)

  const run = async () => {
    setBusy(true)
    setSummary(null)
    try {
      const d = await api<{ ok: boolean; summary?: typeof summary; error?: string }>('/api/kundenfinder/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) })
      if (!d.ok) { setSummary({ area: '', found: 0, neu: 0, duplicates: 0, excluded: 0, possible: 0, analyzed: 0, errors: [d.error || 'Fehler'] }); return }
      setSummary(d.summary!)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Ort"><input className="inp" value={f.city || ''} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="z. B. Köln" /></Fld>
          <Fld label="PLZ (optional)"><input className="inp" value={f.plz || ''} onChange={(e) => setF({ ...f, plz: e.target.value })} placeholder="z. B. 50667" /></Fld>
          <Fld label="Region (optional)"><input className="inp" value={f.region || ''} onChange={(e) => setF({ ...f, region: e.target.value })} placeholder="z. B. Rhein-Erft-Kreis" /></Fld>
          <Fld label={`Umkreis: ${f.radiusKm} km`}><input type="range" min={2} max={50} value={f.radiusKm} onChange={(e) => setF({ ...f, radiusKm: Number(e.target.value) })} className="w-full" /></Fld>
        </div>
        <Fld label="Branche">
          <input className="inp" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} placeholder="Branche eingeben oder unten wählen" />
        </Fld>
        <div className="flex flex-wrap gap-1.5">
          {INDUSTRIES.map((b) => (
            <button key={b} onClick={() => setF({ ...f, industry: b })} className={cls('chip rounded-lg px-2.5 py-1 text-xs', f.industry === b && 'bg-[var(--color-ink)] text-[var(--color-paper)]')}>{b}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Suchbegriff (optional)"><input className="inp" value={f.keyword || ''} onChange={(e) => setF({ ...f, keyword: e.target.value })} placeholder="Filter im Namen" /></Fld>
          <Fld label="Max. Ergebnisse"><input type="number" className="inp" value={f.maxResults} onChange={(e) => setF({ ...f, maxResults: Number(e.target.value) })} /></Fld>
          <div className="flex flex-col justify-end gap-1.5 pb-1">
            <Chk label="Ohne Website" v={!!f.onlyWithoutWebsite} on={(v) => setF({ ...f, onlyWithoutWebsite: v, onlyWithWebsite: v ? false : f.onlyWithWebsite })} />
            <Chk label="Nur mit Telefon" v={!!f.onlyWithPhone} on={(v) => setF({ ...f, onlyWithPhone: v })} />
          </div>
          <div className="flex flex-col justify-end gap-1.5 pb-1">
            <Chk label="Nur mit E-Mail" v={!!f.onlyWithEmail} on={(v) => setF({ ...f, onlyWithEmail: v })} />
            <Chk label="Websites automatisch analysieren" v={f.analyzeWebsites !== false} on={(v) => setF({ ...f, analyzeWebsites: v })} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={run} disabled={busy || (!f.city && !f.plz && !f.region)} className="btn-ink inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium">
            {busy ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} {busy ? 'Suche läuft (OSM + Website-Analyse) …' : 'Unternehmen suchen'}
          </button>
          <span className="text-xs text-[var(--color-muted)]">Quelle: OpenStreetMap · bereits bekannte Unternehmen werden nie erneut vorgeschlagen.</span>
        </div>
      </div>

      {summary && (
        <div className="card p-4">
          {summary.errors.length > 0 && <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{summary.errors.join(' · ')}</div>}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span>Gebiet: <b>{summary.area || '—'}</b></span>
            <span>Gefunden: <b>{summary.found}</b></span>
            <span className="text-green-700">Neu: <b>{summary.neu}</b></span>
            <span className="text-[var(--color-muted)]">Dubletten: <b>{summary.duplicates}</b> (ausgeschlossen: {summary.excluded})</span>
            {summary.possible > 0 && <span className="text-amber-700">Mögliche Dubletten: <b>{summary.possible}</b></span>}
            <span>Analysiert: <b>{summary.analyzed}</b></span>
            {summary.neu > 0 && <button onClick={onDone} className="btn-ink rounded-lg px-3 py-1.5 text-xs">→ Ergebnisse ansehen</button>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────── Ergebnis-/Gespeichert-/Ausschluss-Liste ─────────── */
function CompanyListTab({ scope, onDetail, onSelect, selectedId }: { scope: 'ergebnisse' | 'nachrecherche' | 'gespeichert' | 'ausschluss'; onDetail: (c: Company) => void; onSelect: (c: Company) => void; selectedId?: string | null }) {
  const [rows, setRows] = useState<Company[]>([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [hideEmpty, setHideEmpty] = useState(false) // leere/geparkte Websites ausblenden (§14)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<LeadStatus | ''>('')
  const [sort, setSort] = useState('prio')
  const [priority, setPriority] = useState('')
  const [decider, setDecider] = useState('')
  const [direct, setDirect] = useState('')
  const [quality, setQuality] = useState('')
  const [preset, setPreset] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveFor, setSaveFor] = useState<Company | null>(null)
  const toast = useToast((t) => t.show)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (scope === 'gespeichert') p.set('savedOnly', '1')
    if (scope === 'ausschluss') p.set('excludedOnly', '1')
    // Standard: Ergebnisse = nur qualifizierte (vollständige Kontakte); Nachrecherche = unvollständige
    if (scope === 'ergebnisse') p.set('contact', 'vollstaendig')
    if (scope === 'nachrecherche') p.set('contact', 'unvollstaendig')
    if (q) p.set('q', q)
    if (status) p.set('status', status)
    if (priority) p.set('priority', priority)
    if (decider) p.set('decider', decider)
    if (direct) p.set('direct', direct)
    if (quality) p.set('quality', quality)
    if (preset) p.set('preset', 'entscheider_direkt')
    p.set('sort', sort)
    p.set('stats', '1')
    p.set('limit', '400')
    const d = await api<{ ok: boolean; companies: Company[]; stats?: Record<string, number> }>(`/api/kundenfinder/companies?${p}`)
    let list = d.companies || []
    if (scope === 'ergebnisse' || scope === 'nachrecherche') list = list.filter((c) => !c.saved && !c.excluded)
    setRows(list)
    setStats(d.stats || null)
    setLoading(false)
  }, [scope, q, status, sort, priority, decider, direct, quality, preset])

  useEffect(() => { load() }, [load])

  const act = async (action: string, id: string, extra: Record<string, unknown> = {}) => {
    await api('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) })
    load()
  }
  const copy = (text: string, what: string) => { navigator.clipboard.writeText(text).then(() => toast(`${what} kopiert`, 'success')).catch(() => {}) }

  /** Aus gespeicherten Kunden entfernen (nur Speicherstatus) — Bestätigung + Rückgängig. */
  const unsaveWithUndo = async (c: Company) => {
    if (!confirm('Möchten Sie dieses Unternehmen wirklich aus den gespeicherten Kunden entfernen?')) return
    const r = await fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'unsave', id: c.id }) })
    const d = await r.json().catch(() => null)
    if (!d?.ok) { toast(d?.error || 'Entfernen nicht möglich.', 'error'); return }
    toast('Das Unternehmen wurde aus den gespeicherten Kunden entfernt.', 'success', {
      label: 'Rückgängig',
      onClick: () => { fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', id: c.id, dialog: {} }) }).then(load) }
    })
    load()
  }
  const showList = scope === 'ergebnisse' || scope === 'nachrecherche'
  // „Leere Websites ausblenden" (§14): geparkte/leere/Platzhalter-Seiten filtern — Unternehmen
  // OHNE Website bleiben sichtbar (die sind potenziell interessant, §27).
  const displayRows = hideEmpty ? rows.filter((c) => !EMPTY_WEBSITE_STATES.includes((c.websiteState || '') as WebsiteState)) : rows
  const emptyCount = rows.filter((c) => EMPTY_WEBSITE_STATES.includes((c.websiteState || '') as WebsiteState)).length

  return (
    <div className="space-y-3">
      {showList && stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-sm">
          <Kpi label="Gesamt" v={stats.gesamt} />
          <Kpi label="Qualifiziert" v={stats.qualifiziert} tone="text-green-700" />
          <Kpi label="Nachrecherche" v={stats.nachrecherche} tone="text-amber-700" />
          <Kpi label="Hohes Potenzial" v={stats.hohesPotenzial} />
          <Kpi label="Priorität A" v={stats.prioA} tone="text-green-700" />
          <Kpi label="Gespeichert" v={stats.gespeichert} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]" />
          <input className="inp pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche: Name, Branche, Ort, Domain, Telefon, E-Mail, Ansprechpartner" />
        </div>
        {showList && (
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="inp h-10 w-40" aria-label="Akquise-Priorität filtern">
            <option value="">alle Prioritäten</option>
            <option value="A">A – Sofort prüfen</option>
            <option value="B">B – Interessant</option>
            <option value="C">C – Nachrecherche</option>
            <option value="D">D – Nicht qualifiziert</option>
          </select>
        )}
        {scope !== 'ausschluss' && (
          <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | '')} className="inp h-10 w-48" aria-label="Status filtern">
            <option value="">alle Status</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="inp h-10 w-56" aria-label="Sortierung">
          {SORT_OPTS.map(([k, v]) => <option key={k} value={k}>Sortieren: {v}</option>)}
        </select>
        {emptyCount > 0 && (
          <button
            onClick={() => setHideEmpty((v) => !v)}
            aria-pressed={hideEmpty}
            className={cls('inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors', hideEmpty ? 'bg-[var(--color-ink)] text-white' : 'btn-ghost')}
            title="Leere, geparkte und Platzhalter-Websites ausblenden. Unternehmen ohne Website bleiben sichtbar."
          >
            <Ban size={14} /> Leere Websites ausblenden{hideEmpty ? '' : ` (${emptyCount})`}
          </button>
        )}
        <a href={`/api/kundenfinder/export?${scope === 'gespeichert' ? 'savedOnly=1&' : ''}${showList ? 'contact=' + (scope === 'ergebnisse' ? 'vollstaendig' : 'unvollstaendig') + '&' : ''}${q ? 'q=' + encodeURIComponent(q) : ''}`} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"><Download size={14} /> CSV-Export</a>
      </div>

      {showList && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--color-muted)]">Ansprechpartner:</span>
          <select value={decider} onChange={(e) => setDecider(e.target.value)} className="inp h-9 w-44" aria-label="Entscheider filtern">
            <option value="">alle</option>
            <option value="preferred">bevorzugter Ansprechpartner vorhanden</option>
            <option value="any">Entscheider gefunden</option>
            <option value="owner">Inhaber gefunden</option>
            <option value="md">Geschäftsführer gefunden</option>
            <option value="marketing">Marketingleitung gefunden</option>
            <option value="none">kein Entscheider gefunden</option>
          </select>
          <select value={direct} onChange={(e) => setDirect(e.target.value)} className="inp h-9 w-44" aria-label="Direktkontakt filtern">
            <option value="">Direktkontakt: alle</option>
            <option value="any">Direktkontakt vorhanden</option>
            <option value="mobile">geschäftl. Mobil vorhanden</option>
            <option value="email">direkte E-Mail vorhanden</option>
            <option value="phone">direkte Telefonnummer</option>
            <option value="general">nur allgemeiner Kontakt</option>
            <option value="person_no_contact">Entscheider ohne Direktkontakt</option>
            <option value="mobile_check">Mobilnummer prüfen</option>
          </select>
          <select value={quality} onChange={(e) => setQuality(e.target.value)} className="inp h-9 w-44" aria-label="Quellenqualität filtern">
            <option value="">Quelle: alle</option>
            <option value="official">offiziell bestätigt</option>
            <option value="high">hohe Vertrauenswürdigkeit</option>
            <option value="check">manuelle Prüfung nötig</option>
            <option value="conflict">widersprüchliche Angaben</option>
            <option value="outdated">Daten möglicherweise veraltet</option>
          </select>
          <button onClick={() => setPreset((v) => !v)} className={cls('chip inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5', preset && 'bg-[var(--color-ink)] text-[var(--color-paper)]')} title="Nur Firmen mit hohem Potenzial, vollständigen Daten, identifiziertem Entscheider und mindestens einer direkten geschäftlichen Kontaktmöglichkeit.">
            <Star size={12} /> Entscheider direkt erreichbar
          </button>
          {(decider || direct || quality || preset) && <button onClick={() => { setDecider(''); setDirect(''); setQuality(''); setPreset(false) }} className="text-[var(--color-muted)] underline">zurücksetzen</button>}
        </div>
      )}

      {loading ? (
        <div className="card p-6"><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-11 w-full" />)}</div></div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <div className="text-sm font-medium">{scope === 'ergebnisse' ? 'Keine qualifizierten Leads gefunden.' : scope === 'nachrecherche' ? 'Keine Unternehmen in der Nachrecherche.' : 'Keine Einträge.'}</div>
            <div className="max-w-md text-xs text-[var(--color-muted)]">{scope === 'ergebnisse' ? 'Passe die Filter an oder öffne „Nachrecherche“, um Unternehmen mit unvollständigen Kontaktdaten zu prüfen. Oder starte eine neue Suche unter „Unternehmen finden“.' : 'Sobald Telefon und E-Mail vorhanden sind, rücken Unternehmen automatisch in die qualifizierte Ergebnisliste.'}</div>
          </div>
        </div>
      ) : (
        <div className="card max-h-[calc(100dvh-230px)] overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--color-surface)] text-left shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="p-3">Unternehmen</th><th className="p-3">Kontaktstatus</th><th className="p-3">Ansprechpartner / Direktkontakt</th><th className="p-3">Telefon / E-Mail</th>
                <th className="p-3">Website</th><th className="p-3">Potenzial</th><th className="p-3 min-w-[170px]">KI-Website-Notiz</th><th className="p-3">Priorität</th><th className="p-3">Status</th><th className="p-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((c) => {
                const cc = c.contactCompleteness ? CONTACT[c.contactCompleteness] : null
                const active = c.id === selectedId
                return (
                  <tr
                    key={c.id}
                    aria-selected={active}
                    className={cls(
                      'relative cursor-pointer border-b border-[var(--color-line)]/60 transition-colors',
                      active ? 'bg-[var(--color-gold-soft)]/55' : 'hover:bg-[var(--color-hover)]'
                    )}
                    onClick={() => onDetail(c)}
                  >
                    <td className="relative p-3">
                      {/* Aktive Auswahl: farbiger Balken links + Label — nicht nur über Farbe vermittelt. */}
                      {active && <span aria-hidden className="absolute top-0 bottom-0 left-0 w-[3px] bg-[var(--color-gold)]" />}
                      <div className={cls('font-medium hover:underline', active && 'text-[var(--color-ink)]')}>{c.name}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {active && <span className="mr-1.5 rounded bg-[var(--color-gold)] px-1 py-0.5 text-[9px] font-semibold text-white align-middle">Ausgewählt</span>}
                        {c.industry || '—'}{c.city ? ` · ${c.city}` : ''}{c.contactName ? ` · ${c.contactName}` : ''}
                      </div>
                    </td>
                    <td className="p-3">{cc ? <StatusBadge label={cc.label} tone={cc.tone} /> : <span className="text-xs text-[var(--color-muted)]">—</span>}</td>
                    <td className="p-3 align-top">
                      {c.preferredPersonName ? (
                        <div className="max-w-[190px]">
                          <div className="truncate text-[13px] font-medium" title={c.preferredPersonName}>{c.preferredPersonName}</div>
                          <div className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                            {c.decisionRelevance && c.decisionRelevance !== 'unbekannt' && <span className={cls('inline-block h-1.5 w-1.5 rounded-full', c.decisionRelevance === 'sehr_hoch' ? 'bg-green-600' : c.decisionRelevance === 'hoch' ? 'bg-blue-500' : 'bg-amber-500')} />}
                            <span className="truncate" title={c.preferredPersonRole || ''}>{c.preferredPersonRole || 'Ansprechpartner'}</span>
                          </div>
                          {(c.hasBusinessMobile || c.hasDirectEmail || c.hasDirectPhone) ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {c.hasBusinessMobile && <span title="Geschäftliche Mobilnummer der Person" className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1 py-0.5 text-[10px] text-green-700"><Smartphone size={10} /> Mobil</span>}
                              {c.hasDirectEmail && <span title="Direkte geschäftliche E-Mail" className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-700"><Mail size={10} /> E-Mail</span>}
                              {c.hasDirectPhone && !c.hasBusinessMobile && <span title="Direkte Telefonnummer / Durchwahl" className="inline-flex items-center gap-0.5 rounded bg-[var(--color-paper-2)] px-1 py-0.5 text-[10px]"><Phone size={10} /> Durchwahl</span>}
                            </div>
                          ) : <div className="mt-0.5 text-[10px] text-amber-700" title="Ein Entscheider ist bekannt, aber es wurde keine direkte Kontaktmöglichkeit gefunden.">Direktkontakt fehlt</div>}
                        </div>
                      ) : c.hasDecisionMaker ? <span className="text-xs text-[var(--color-ink-soft)]">Entscheider bekannt</span>
                      : (c.peopleCount ?? 0) > 0 ? <span className="text-xs text-[var(--color-muted)]">{c.peopleCount} Person(en)</span>
                      : <span className="text-xs text-[var(--color-muted)]">nur allg. Kontakt<br /><span className="text-[10px] text-[var(--color-muted)]/70">nicht recherchiert</span></span>}
                    </td>
                    <td className="p-3 align-top text-xs" onClick={(e) => { e.stopPropagation(); onSelect(c) }}>
                      <div className="max-w-[170px] space-y-0.5">
                        {c.phone && <PhoneLink phone={c.phone} className="text-[11px]" onSelect={() => onSelect(c)} />}
                        {c.email && <button onClick={() => copy(c.email!, 'E-Mail')} title={c.email} className="flex w-full items-center gap-1 hover:text-[var(--color-gold)]"><Mail size={11} className="shrink-0" /> <span className="truncate">{c.email}</span></button>}
                        {!c.phone && !c.email && <span className="text-red-500">keine</span>}
                      </div>
                    </td>
                    <td className="p-3 text-xs" onClick={(e) => { e.stopPropagation(); onSelect(c) }}>
                      {c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-gold)] hover:underline"><Globe size={11} /> {c.domainNorm || 'öffnen'}</a> : <span className="text-[var(--color-muted)]">keine Website</span>}
                      {c.websiteState && <div className="mt-1"><WebsiteStateBadge state={c.websiteState as WebsiteState} manual={!!c.websiteStateManual} /></div>}
                    </td>
                    <td className="p-3"><ScoreBadge value={c.websiteScore} direction="low" /></td>
                    <td className="p-3 align-top"><div className="line-clamp-3 max-w-[190px] text-xs text-[var(--color-ink-soft)]" title={c.aiWebsiteNote || ''}>{c.aiWebsiteNote || <span className="text-[var(--color-muted)]">—</span>}</div></td>
                    <td className="p-3" title={c.acquisitionReason || ''}>{c.acquisitionPriority ? <StatusBadge label={c.acquisitionPriority} tone={PRIO_TONE[c.acquisitionPriority]} /> : '—'}</td>
                    <td className="p-3 align-top" onClick={(e) => { e.stopPropagation(); onSelect(c) }}>
                      <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value as LeadStatus, load)} className="inp h-8 w-36 text-xs">
                        {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="p-3" onClick={(e) => { e.stopPropagation(); onSelect(c) }}>
                      <div className="flex items-center justify-end gap-1">
                        {scope !== 'gespeichert' && !c.excluded && <button title="Speichern" onClick={() => setSaveFor(c)} className="btn-icon p-1.5"><Save size={15} className="text-green-600" /></button>}
                        {scope === 'gespeichert' && <button title="Aus gespeicherten Kunden entfernen" aria-label="Aus gespeicherten Kunden entfernen" onClick={() => unsaveWithUndo(c)} className="btn-icon p-1.5"><BookmarkX size={15} className="text-[var(--color-ink-soft)]" /></button>}
                        {!c.excluded && <button title="Nicht geeignet" onClick={() => act('exclude', c.id, { reason: 'nicht geeignet', status: 'nicht_geeignet' })} className="btn-icon p-1.5"><Ban size={15} className="text-red-500" /></button>}
                        <button title="Website erneut prüfen" onClick={() => analyzeCompany(c.id, load)} className="btn-icon p-1.5"><RefreshCw size={15} /></button>
                        {c.website && <a title="Website öffnen" href={c.website} target="_blank" rel="noreferrer" className="btn-icon p-1.5"><ExternalLink size={15} /></a>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {saveFor && <SaveDialog company={saveFor} onClose={() => setSaveFor(null)} onSaved={() => { setSaveFor(null); load() }} />}
    </div>
  )
}

async function updateStatus(id: string, status: LeadStatus, reload: () => void) {
  await fetch(`/api/kundenfinder/company/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) })
  reload()
}
async function analyzeCompany(id: string, reload: () => void) {
  await fetch('/api/kundenfinder/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
  reload()
}

/* ─────────── Speichern-Dialog ─────────── */
function SaveDialog({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState({ priority: 'mittel', status: 'interessant' as LeadStatus, assignee: '', nextStep: '', followupDate: '', note: '', tags: '' })
  const save = async () => {
    await fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', id: company.id, dialog: { priority: d.priority, status: d.status, assignee: d.assignee || undefined, nextStep: d.nextStep || undefined, followupDate: d.followupDate || undefined, tags: d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined } }) })
    if (d.note.trim()) await fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'note', id: company.id, note: d.note.trim() }) })
    onSaved()
  }
  return (
    <Modal onClose={onClose} title={`Speichern: ${company.name}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Fld label="Priorität"><select className="inp" value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value })}><option value="hoch">hoch</option><option value="mittel">mittel</option><option value="niedrig">niedrig</option></select></Fld>
        <Fld label="Status"><select className="inp" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as LeadStatus })}>{Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Fld>
        <Fld label="Zuständig"><input className="inp" value={d.assignee} onChange={(e) => setD({ ...d, assignee: e.target.value })} /></Fld>
        <Fld label="Wiedervorlage"><input type="date" className="inp" value={d.followupDate} onChange={(e) => setD({ ...d, followupDate: e.target.value })} /></Fld>
        <Fld label="Nächster Schritt"><input className="inp" value={d.nextStep} onChange={(e) => setD({ ...d, nextStep: e.target.value })} /></Fld>
        <Fld label="Tags (Komma)"><input className="inp" value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })} /></Fld>
      </div>
      <Fld label="Notiz"><textarea className="inp h-20" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></Fld>
      <div className="flex justify-end gap-2"><button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">Abbrechen</button><button onClick={save} className="btn-ink rounded-lg px-4 py-2 text-sm">Speichern</button></div>
    </Modal>
  )
}

/* ─────────── Pipeline (Status-Spalten) ─────────── */
const PIPE: LeadStatus[] = ['neu', 'pruefen', 'interessant', 'kontakt_vorbereiten', 'kontaktiert', 'wiedervorlage', 'vorschlag_versendet', 'gespraech', 'angebot_versendet', 'kunde', 'abgelehnt']
function PipelineTab({ onDetail }: { onDetail: (c: Company) => void }) {
  const [rows, setRows] = useState<Company[]>([])
  const load = useCallback(async () => {
    const d = await api<{ ok: boolean; companies: Company[] }>('/api/kundenfinder/companies?savedOnly=1&limit=500')
    setRows(d.companies || [])
  }, [])
  useEffect(() => { load() }, [load])
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-muted)]">Status per Auswahl ändern (Drag-and-drop folgt). Jede Statusänderung wird in der Historie gespeichert.</p>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {PIPE.map((st) => {
          const items = rows.filter((c) => c.status === st)
          return (
            <div key={st} className="w-64 shrink-0 rounded-xl bg-[var(--color-paper-2)]/50 p-2">
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium"><span>{LEAD_STATUS_LABELS[st]}</span><span className="text-[var(--color-muted)]">{items.length}</span></div>
              <div className="space-y-2">
                {items.map((c) => (
                  <div key={c.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-2 text-xs">
                    <button onClick={() => onDetail(c)} className="text-left font-medium hover:underline">{c.name}</button>
                    <div className="text-[10px] text-[var(--color-muted)]">{c.city} · Web {c.websiteScore ?? '—'} · Lead {c.leadScore ?? '—'}</div>
                    <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value as LeadStatus, load)} className="inp mt-1 h-7 w-full text-[11px]">
                      {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────── Suchverlauf ─────────── */
function VerlaufTab() {
  const [runs, setRuns] = useState<{ id: string; area: string; industry: string; startedAt: string; found: number; neu: number; duplicates: number; excluded: number; status: string; errors: string[] }[]>([])
  useEffect(() => { api<{ runs: typeof runs }>('/api/kundenfinder/runs').then((d) => setRuns(d.runs || [])) }, [])
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-muted)]"><tr><th className="p-3">Datum</th><th className="p-3">Gebiet</th><th className="p-3">Branche</th><th className="p-3">Gefunden</th><th className="p-3">Neu</th><th className="p-3">Dubletten</th><th className="p-3">Status</th></tr></thead>
        <tbody>
          {runs.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-[var(--color-muted)]">Noch keine Suchläufe.</td></tr> : runs.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-line)]/60">
              <td className="p-3 text-xs">{new Date(r.startedAt).toLocaleString('de-DE')}</td>
              <td className="p-3 text-xs">{r.area}</td><td className="p-3 text-xs">{r.industry}</td>
              <td className="p-3">{r.found}</td><td className="p-3 text-green-700">{r.neu}</td><td className="p-3 text-[var(--color-muted)]">{r.duplicates}</td>
              <td className="p-3 text-xs">{r.status}{r.errors?.length ? ` · ${r.errors.length} Fehler` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─────────── Einstellungen (Stufe 1: CSV-Import + Hinweise) ─────────── */
function EinstellungenTab() {
  const [csv, setCsv] = useState('')
  const [res, setRes] = useState<{ neu: number; duplicates: number; possible: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const doImport = async () => {
    setBusy(true); setRes(null)
    try {
      const d = await api<{ ok: boolean; neu: number; duplicates: number; possible: number; total: number; error?: string }>('/api/kundenfinder/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv }) })
      if (d.ok) setRes(d)
      else setRes({ neu: 0, duplicates: 0, possible: 0, total: 0 })
    } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-display text-lg"><Upload size={17} className="text-[var(--color-gold)]" /> CSV-Import (mit Dubletten-Schutz)</h3>
        <p className="text-xs text-[var(--color-muted)]">Spalten (Semikolon oder Komma): <code>name;plz;ort;website;telefon;email;branche;ansprechpartner</code>. Bereits bekannte Unternehmen werden erkannt und nicht doppelt angelegt.</p>
        <textarea className="inp h-40 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'name;plz;ort;website\nMuster GmbH;50667;Köln;muster.de'} />
        <div className="flex items-center gap-3">
          <button onClick={doImport} disabled={busy || !csv.trim()} className="btn-ink inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm">{busy ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />} Importieren</button>
          {res && <span className="text-sm">Verarbeitet: {res.total} · <b className="text-green-700">neu {res.neu}</b> · Dubletten {res.duplicates}{res.possible ? ` · mögliche ${res.possible}` : ''}</span>}
        </div>
      </div>
      <RecomputeCard />
      <div className="card space-y-2 p-5 text-sm text-[var(--color-muted)]">
        <h3 className="font-display text-lg text-[var(--color-ink)]">Hinweise</h3>
        <p>Datenquelle Stufe 1: <b>OpenStreetMap/Overpass</b> (kostenlos, kein API-Key). Weitere Provider (Karten-/Such-APIs) sind über die Provider-Struktur ergänzbar.</p>
        <p><b>Akquise-Priorität</b> (A–D) = Website-Potenzial 50 % · Kontaktvollständigkeit 25 % · Branche 10 % · Region 5 % · Ansprechpartner 5 % · Datenvollständigkeit 5 %. Ohne Telefon UND E-Mail nie Klasse A. Standardansicht zeigt nur qualifizierte Leads (Telefon + E-Mail); der Rest steht unter „Nachrecherche“.</p>
        <p>Website-Potenzial (0–100) = Technik 25 · Mobile 20 · Performance 15 · Design 20 · Inhalt/Kontakt 15 · Aktualität 5. Höher = mehr Verbesserungsbedarf.</p>
        <p>Noch nicht in dieser Stufe: eigene Nav-Routen für „Gespeicherte Kunden“/„Pipeline“, Drag-and-drop, Rollen/Rechte, Aufgaben-Board, gespeicherte Filter-Presets, Dashboard-Diagramme. Dubletten-Schutz und Kern-Workflows sind voll funktionsfähig.</p>
      </div>
    </div>
  )
}

/* ─────────── Prioritäten neu berechnen (Einstellungen) ─────────── */
function RecomputeCard() {
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<number | null>(null)
  const run = async (savedOnly: boolean) => {
    setBusy(true); setRes(null)
    try { const d = await api<{ ok: boolean; updated: number }>('/api/kundenfinder/recompute', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ savedOnly }) }); setRes(d.updated ?? 0) } finally { setBusy(false) }
  }
  return (
    <div className="card space-y-3 p-5">
      <h3 className="flex items-center gap-2 font-display text-lg"><RefreshCw size={17} className="text-[var(--color-gold)]" /> Prioritäten neu berechnen</h3>
      <p className="text-xs text-[var(--color-muted)]">Berechnet Kontaktvollständigkeit, Akquise-Priorität (A–D) und KI-Notizen für bestehende Unternehmen neu. Ändert keine Analysedaten; manuell bearbeitete Notizen bleiben erhalten.</p>
      <div className="flex items-center gap-3">
        <button onClick={() => run(false)} disabled={busy} className="btn-ink inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm">{busy ? <RefreshCw size={15} className="animate-spin" /> : <RefreshCw size={15} />} Alle neu berechnen</button>
        <button onClick={() => run(true)} disabled={busy} className="btn-ghost rounded-lg px-4 py-2 text-sm">Nur gespeicherte</button>
        {res != null && <span className="text-sm text-green-700">{res} Unternehmen aktualisiert.</span>}
      </div>
    </div>
  )
}

/* ─────────── Detail-Drawer ─────────── */
interface Activity { type: string; note?: string; nextStep?: string; followup?: string; user?: string; at: string }
interface Conflict { id: number; field: string; valueA: string; valueB: string; sourceA?: string; sourceB?: string }
function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ company: Company; notes: { id: number; content: string; author: string; createdAt: string }[]; history: { fromStatus: string; toStatus: string; at: string }[]; analysis: { score: number; issues: string; breakdown: string; reachable: number; https: number; url: string; analyzed_at: string } | null; activities?: Activity[]; people?: CompanyPerson[]; preferred?: CompanyPerson | null; conflicts?: Conflict[]; peopleSummary?: string } | null>(null)
  const [note, setNote] = useState('')
  const [aiEdit, setAiEdit] = useState<string | null>(null)
  const toast = useToast((t) => t.show)
  const load = useCallback(async () => { const d = await api<{ ok: boolean } & NonNullable<typeof data>>(`/api/kundenfinder/company/${id}`); if (d.ok) { setData(d); setAiEdit(null) } }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!data) return null
  const c = data.company
  const cc = c.contactCompleteness ? CONTACT[c.contactCompleteness] : null
  const issues: string[] = data.analysis ? JSON.parse(data.analysis.issues || '[]') : c.websiteReasons || []
  const bd = data.analysis ? (JSON.parse(data.analysis.breakdown || '{}') as Record<string, number>) : null
  const addNote = async () => { if (!note.trim()) return; await fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'note', id, note: note.trim() }) }); setNote(''); load() }
  const reanalyze = async () => { await fetch('/api/kundenfinder/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); load() }
  const regenNote = async () => { await fetch('/api/kundenfinder/ai-note', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'regenerate' }) }); load() }
  const saveNote = async () => { if (aiEdit == null) return; await fetch('/api/kundenfinder/ai-note', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'save', note: aiEdit }) }); load() }
  const logActivity = async (type: string) => { await fetch('/api/kundenfinder/activity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, type }) }); load() }
  const copy = (t: string, w: string) => navigator.clipboard.writeText(t).then(() => toast(`${w} kopiert`, 'success')).catch(() => {})

  /**
   * Aus gespeicherten Kunden entfernen — nur der Speicherstatus, keine Datenlöschung.
   * Mit Bestätigung und Rückgängig-Meldung (setzt bei Bedarf sofort wieder auf gespeichert).
   */
  const unsave = async () => {
    if (!confirm('Möchten Sie dieses Unternehmen wirklich aus den gespeicherten Kunden entfernen?')) return
    const r = await fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'unsave', id }) })
    const d = await r.json().catch(() => null)
    if (!d?.ok) { toast(d?.error || 'Entfernen nicht möglich.', 'error'); return }
    toast('Das Unternehmen wurde aus den gespeicherten Kunden entfernt.', 'success', {
      label: 'Rückgängig',
      onClick: () => { fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', id, dialog: {} }) }).then(load) }
    })
    load()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-[var(--color-paper)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div><h2 className="font-display text-2xl">{c.name}</h2><p className="text-sm text-[var(--color-muted)]">{c.industry} · {[c.street, c.houseNumber].filter(Boolean).join(' ')} {c.plz} {c.city}</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--color-paper-2)]"><X size={18} /></button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {c.acquisitionPriority && <span title={c.acquisitionReason || ''}><StatusBadge label={`Priorität ${c.acquisitionPriority}`} tone={PRIO_TONE[c.acquisitionPriority]} /></span>}
          {cc && <StatusBadge label={cc.label} tone={cc.tone} />}
          <StatusBadge label={LEAD_STATUS_LABELS[c.status]} tone="neutral" />
        </div>
        {c.acquisitionReason && <p className="mb-4 text-xs text-[var(--color-muted)]">{c.acquisitionReason}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          {c.phone && <PhoneLink phone={c.phone} />}
          {c.email && <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-h-[32px] items-center gap-1 hover:text-[var(--color-gold)]" title={`E-Mail an ${c.email}`}><Mail size={13} /> {c.email}</a>}
          {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-gold)] hover:underline"><Globe size={13} /> {c.domainNorm}</a>}
          {(c.lat && c.lng) && <a href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline"><MapPin size={13} /> Karte</a>}
        </div>

        {/* Website-Zustand + manuelle Korrektur (§13/§15) */}
        <div className="mb-4 rounded-lg border border-[var(--color-line)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-muted)]">Website-Zustand:</span>
              {c.websiteState ? <WebsiteStateBadge state={c.websiteState as WebsiteState} manual={!!c.websiteStateManual} /> : <span className="text-xs text-[var(--color-muted)]">noch nicht geprüft</span>}
            </div>
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--color-muted)]">Manuell korrigieren:</span>
              <select
                value={c.websiteStateManual || ''}
                onChange={async (e) => { await fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'website_state', id, websiteState: e.target.value || null }) }); load() }}
                className="inp h-8 text-xs"
              >
                <option value="">— automatisch —</option>
                {(['vorhanden', 'schlecht', 'einfach', 'leer', 'platzhalter', 'geparkt', 'coming_soon', 'baustelle', 'wartung', 'fehlerseite', 'nur_social', 'nicht_erreichbar', 'keine', 'pruefung'] as WebsiteState[]).map((s) => (
                  <option key={s} value={s}>{WEBSITE_STATE_LABELS[s]}</option>
                ))}
              </select>
            </label>
          </div>
          {c.websiteStateReason && <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">{c.websiteStateReason}</p>}
          {c.websiteStateManual && <p className="mt-1 text-[11px] text-[var(--color-gold)]">Manuell festgelegt — die automatische Analyse überschreibt diesen Wert nicht.</p>}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <div className="text-xs text-[var(--color-muted)]">Website-Potenzial</div>
            <div className="text-2xl font-semibold" style={{ color: wsColor(c.websiteScore) }}>{c.websiteScore ?? '—'}<span className="text-sm text-[var(--color-muted)]">/100</span></div>
            {!c.website && <div className="text-xs text-red-500">Keine Website gefunden</div>}
            {bd && <div className="mt-1 text-[10px] text-[var(--color-muted)]">Tech {bd.technik} · Mob {bd.mobile} · Perf {bd.performance} · Design {bd.design} · Inhalt {bd.inhalt} · Akt {bd.aktualitaet}</div>}
          </div>
          <div className="rounded-lg border border-[var(--color-line)] p-3">
            <div className="text-xs text-[var(--color-muted)]">Lead-Score</div>
            <div className="text-2xl font-semibold" style={{ color: leadColor(c.leadScore) }}>{c.leadScore ?? '—'}</div>
            <div className="text-xs">{c.leadLabel || '—'}</div>
          </div>
        </div>

        <button onClick={reanalyze} className="btn-ghost mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><RefreshCw size={13} /> Website erneut prüfen</button>

        {/* KI-Website-Notiz */}
        <div className="mb-4 rounded-lg border border-[var(--color-line)] p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium">KI-Website-Notiz{c.aiNoteEdited ? ' (manuell bearbeitet)' : ''}</span>
            <div className="flex gap-1">
              {aiEdit == null && <button onClick={() => copy(c.aiWebsiteNote || '', 'Notiz')} className="btn-icon p-1" title="kopieren"><Copy size={13} /></button>}
              {aiEdit == null ? (
                <>
                  <button onClick={() => setAiEdit(c.aiWebsiteNote || '')} className="btn-icon p-1" title="bearbeiten"><Pencil size={13} /></button>
                  <button onClick={regenNote} className="btn-icon p-1" title="neu generieren"><RefreshCw size={13} /></button>
                </>
              ) : (
                <>
                  <button onClick={saveNote} className="btn-icon p-1 text-green-600" title="speichern"><Check size={14} /></button>
                  <button onClick={() => setAiEdit(null)} className="btn-icon p-1" title="abbrechen"><X size={14} /></button>
                </>
              )}
            </div>
          </div>
          {aiEdit == null ? (
            <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{c.aiWebsiteNote || 'Noch keine Notiz. Website analysieren oder „neu generieren“.'}</p>
          ) : (
            <textarea value={aiEdit} onChange={(e) => setAiEdit(e.target.value)} className="inp h-24 text-xs" />
          )}
        </div>

        <PeopleSection companyId={id} people={data.people || []} preferred={data.preferred || null} summary={data.peopleSummary} conflicts={data.conflicts || []} website={c.website} onReload={load} />

        {issues.length > 0 && (
          <div className="mb-4">
            <div className="mb-1 text-sm font-medium">Verbesserungsvorschläge / Hinweise</div>
            <ul className="space-y-1 text-xs text-[var(--color-ink-soft)]">{issues.map((i, k) => <li key={k}>• {i}</li>)}</ul>
          </div>
        )}
        {(c.leadReasons?.length ?? 0) > 0 && (
          <div className="mb-4"><div className="mb-1 text-sm font-medium">Lead-Begründung</div><ul className="space-y-1 text-xs text-[var(--color-muted)]">{c.leadReasons!.map((r, k) => <li key={k}>• {r}</li>)}</ul></div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Fld label="Status"><select className="inp" value={c.status} onChange={(e) => updateStatus(id, e.target.value as LeadStatus, load)}>{Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Fld>
          <Fld label="Nächster Schritt"><input className="inp" defaultValue={c.nextStep || ''} onBlur={(e) => fetch(`/api/kundenfinder/company/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nextStep: e.target.value }) })} /></Fld>
        </div>

        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium">Notizen</span></div>
          <div className="flex gap-2"><input className="inp flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz hinzufügen …" onKeyDown={(e) => e.key === 'Enter' && addNote()} /><button onClick={addNote} className="btn-ink rounded-lg px-3 py-2 text-sm">+</button></div>
          <ul className="mt-2 space-y-1 text-xs">{data.notes.map((n) => <li key={n.id} className="rounded bg-[var(--color-paper-2)]/50 px-2 py-1">{n.content} <span className="text-[var(--color-muted)]">· {new Date(n.createdAt).toLocaleDateString('de-DE')}</span></li>)}</ul>
        </div>

        {/* Kontaktaktivitäten */}
        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium">Kontaktaktivität dokumentieren</div>
          <div className="flex flex-wrap gap-1.5">
            {[['angerufen', 'Angerufen'], ['nicht_erreicht', 'Nicht erreicht'], ['email_versendet', 'E-Mail versendet'], ['termin', 'Termin vereinbart'], ['vorschlag_versendet', 'Vorschlag versendet'], ['absage', 'Absage']].map(([t, l]) => (
              <button key={t} onClick={() => logActivity(t)} className="chip rounded-lg px-2.5 py-1 text-xs"><PhoneCall size={11} className="mr-1 inline" />{l}</button>
            ))}
          </div>
          {(data.activities?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">{data.activities!.slice(0, 6).map((a, k) => <li key={k}>{a.type} · {new Date(a.at).toLocaleString('de-DE')}{a.note ? ` · ${a.note}` : ''}</li>)}</ul>
          )}
        </div>

        {data.history.length > 0 && (
          <div className="text-xs text-[var(--color-muted)]"><div className="mb-1 font-medium text-[var(--color-ink)]">Historie</div>{data.history.map((h, k) => <div key={k}>{LEAD_STATUS_LABELS[h.fromStatus as LeadStatus] || h.fromStatus} → {LEAD_STATUS_LABELS[h.toStatus as LeadStatus] || h.toStatus} · {new Date(h.at).toLocaleDateString('de-DE')}</div>)}</div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-4">
          {c.saved && (
            <button onClick={unsave} className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-[var(--color-ink-soft)]">Aus gespeicherten Kunden entfernen</button>
          )}
          {!c.excluded && <button onClick={() => fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'exclude', id, reason: 'kein kontakt gewünscht', status: 'kein_kontakt' }) }).then(load)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-amber-700">Kein Kontakt gewünscht</button>}
          <button onClick={() => { if (confirm('Unternehmen VOLLSTÄNDIG entfernen (auch aus dem Dubletten-Schutz)? Es kann danach erneut vorgeschlagen werden.')) fetch('/api/kundenfinder/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id }) }).then(onClose) }} className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-red-600">Vollständig entfernen</button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">„Aus gespeicherten Kunden entfernen“ löscht nur den Speicherstatus. Notizen, Verlauf und Pipeline bleiben erhalten. „Vollständig entfernen“ löscht den Datensatz endgültig.</p>
        {EXCLUDING_STATUSES.includes(c.status) && <p className="mt-2 text-[11px] text-amber-700">Dieses Unternehmen ist vom erneuten Vorschlagen ausgeschlossen (Status „{LEAD_STATUS_LABELS[c.status]}“).</p>}
      </div>
    </div>
  )
}

/* ─────────── Ansprechpartner & Entscheider ─────────── */
const CONF_TONE: Record<string, string> = { sehr_hoch: 'text-green-700', hoch: 'text-blue-700', mittel: 'text-amber-700', niedrig: 'text-red-600' }
const MOB_DOT: Record<string, string> = { geschaeftlich: 'bg-green-600', moeglicherweise: 'bg-amber-500', allgemein: 'bg-gray-400', privat_nicht_ausgeschlossen: 'bg-red-500' }

function PeopleSection({ companyId, people, preferred, summary, conflicts, website, onReload }: {
  companyId: string; people: CompanyPerson[]; preferred: CompanyPerson | null; summary?: string; conflicts: Conflict[]; website?: string; onReload: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const toast = useToast((t) => t.show)
  const copy = (t: string, w: string) => navigator.clipboard.writeText(t).then(() => toast(`${w} kopiert`, 'success')).catch(() => {})

  const research = async () => {
    setBusy(true); setLog(['Recherche gestartet …'])
    try {
      const d = await api<{ ok: boolean; error?: string; run?: { log: string[]; peopleFound: number; contactsFound: number } }>('/api/kundenfinder/people/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: companyId }) })
      if (!d.ok) { setLog([d.error || 'Fehler bei der Recherche.']); return }
      setLog(d.run?.log || [])
      toast(`${d.run?.peopleFound ?? 0} Person(en), ${d.run?.contactsFound ?? 0} Kontakt(e) gefunden`, 'success')
      onReload()
    } catch (e) {
      setLog(['Fehler: ' + (e instanceof Error ? e.message : String(e))])
    } finally { setBusy(false) }
  }

  const ordered = [...people].sort((a, b) => Number(b.id === preferred?.id) - Number(a.id === preferred?.id) || b.decisionScore - a.decisionScore)

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-line)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium"><UserSearch size={15} className="text-[var(--color-gold)]" /> Ansprechpartner und Entscheider</span>
        <div className="flex gap-1">
          <button onClick={() => setPasteOpen(true)} className="btn-icon p-1.5" title="Impressum-/Team-Text manuell einfügen"><ClipboardList size={14} /></button>
          <button onClick={research} disabled={busy} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" title="Personen & Entscheider aus Impressum/Team/Über-uns/Kontakt der Website recherchieren">
            {busy ? <RefreshCw size={13} className="animate-spin" /> : <UserSearch size={13} />} {people.length ? 'Erneut recherchieren' : 'Personen recherchieren'}
          </button>
        </div>
      </div>

      {busy || log.length > 0 ? (
        <ul className="mb-2 space-y-0.5 rounded-md bg-[var(--color-paper-2)]/60 p-2 text-[11px] text-[var(--color-muted)]">
          {log.map((l, i) => <li key={i}>• {l}</li>)}
          {busy && <li className="text-[var(--color-ink-soft)]">… läuft</li>}
        </ul>
      ) : null}

      {conflicts.length > 0 && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <div>{conflicts.map((c) => <div key={c.id}>Widerspruch bei {c.field}: „{c.valueA}" vs. „{c.valueB}". Bitte manuell prüfen.</div>)}</div>
        </div>
      )}

      {summary && <p className="mb-2 rounded-md bg-[var(--color-paper-2)]/60 px-2.5 py-2 text-xs leading-relaxed text-[var(--color-ink-soft)]">{summary}</p>}

      {ordered.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">{website ? 'Noch keine Personen recherchiert. „Personen recherchieren" prüft Impressum, Team, Über-uns und Kontakt.' : 'Keine Website hinterlegt – für die automatische Recherche nötig. Alternativ Impressum-Text manuell einfügen.'}</p>
      ) : (
        <div className="space-y-2">
          {ordered.map((p) => <PersonRow key={p.id} person={p} isPreferred={p.id === preferred?.id} copy={copy} onReload={onReload} />)}
        </div>
      )}

      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-[var(--color-muted)]">
        <ShieldCheck size={12} className="mt-0.5 shrink-0" />
        Eine öffentlich sichtbare (Mobil-)Nummer ist keine Einwilligung in Werbung. Telefonwerbung gegenüber Unternehmen setzt nach § 7 UWG mindestens eine mutmaßliche Einwilligung voraus; E-Mail-Werbung ist strenger geregelt. Betroffene können der Nutzung ihrer Daten für Direktwerbung jederzeit widersprechen.
      </p>

      {pasteOpen && <PastePeopleModal companyId={companyId} onClose={() => setPasteOpen(false)} onDone={() => { setPasteOpen(false); onReload() }} />}
    </div>
  )
}

function PersonRow({ person, isPreferred, copy, onReload }: { person: CompanyPerson; isPreferred: boolean; copy: (t: string, w: string) => void; onReload: () => void }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<CompanyPerson | null>(null)
  const [noteEdit, setNoteEdit] = useState<string | null>(null)
  const blocked = BLOCKING_PERSON_STATUSES.includes(person.contactStatus)
  const rel = person.decisionRelevance

  const toggle = async () => {
    const next = !open; setOpen(next)
    if (next && !detail) { const d = await api<{ ok: boolean; person: CompanyPerson }>(`/api/kundenfinder/person/${person.id}`); if (d.ok) setDetail(d.person) }
  }
  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/kundenfinder/person/${person.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    onReload()
  }

  return (
    <div className={cls('rounded-lg border p-2.5', isPreferred ? 'border-[var(--color-gold)] bg-[var(--color-gold-soft)]/25' : 'border-[var(--color-line)]', blocked && 'opacity-55')}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={toggle} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            {isPreferred && <Star size={13} className="shrink-0 text-[var(--color-gold)]" fill="currentColor" />}
            <span className="truncate text-[13px] font-medium">{person.fullName}</span>
            <StatusBadge label={REL_SHORT[rel]} tone={REL_TONE[rel]} />
            <ChevronDown size={13} className={cls('shrink-0 text-[var(--color-muted)] transition-transform', open && 'rotate-180')} />
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{person.role || 'Rolle unklar'}{person.department ? ` · ${person.department}` : ''} · {CONFIDENCE_LABELS[person.confidenceLevel]}</div>
        </button>
      </div>

      {/* Kontaktmöglichkeiten */}
      {(person.contacts?.length ?? 0) > 0 && !blocked && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {person.contacts!.map((cm) => {
            if (cm.kind === 'email') return <a key={cm.id} href={`mailto:${cm.value}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-[var(--color-gold)]" title={`E-Mail an ${cm.value}`}><Mail size={11} /> {cm.value}{cm.isDirect && <span className="text-[9px] text-green-700">direkt</span>}</a>
            // Fax nie als Anruf-Knopf (Spezifikation §20) — nur kopierbar anzeigen.
            if (cm.kind === 'fax') return <button key={cm.id} onClick={() => copy(cm.value, 'Faxnummer')} className="inline-flex items-center gap-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]" title="Faxnummer kopieren"><Phone size={11} /> {cm.value} <span className="text-[9px]">Fax</span></button>
            if (cm.isMobile) return (
              <span key={cm.id} className="inline-flex items-center gap-1" title={cm.mobileConfidence ? MOBILE_CONFIDENCE_LABELS[cm.mobileConfidence] : 'Mobilnummer'}>
                {telHref(cm.value) ? <a href={telHref(cm.value)!} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-[var(--color-gold)]"><Smartphone size={11} /> {cm.value}</a> : <span className="inline-flex items-center gap-1 text-amber-700"><Smartphone size={11} /> {cm.value}</span>}
                <span className={cls('h-1.5 w-1.5 rounded-full', cm.mobileConfidence ? MOB_DOT[cm.mobileConfidence] : 'bg-gray-400')} />
              </span>
            )
            return <PhoneLink key={cm.id} phone={cm.value} className="text-xs" showCopy={false} />
          })}
        </div>
      )}
      {blocked && <div className="mt-1 text-[11px] text-amber-700">{PERSON_CONTACT_STATUS_LABELS[person.contactStatus]} – Kontaktdaten nicht aktiv nutzen.</div>}

      {open && (
        <div className="mt-2 space-y-2 border-t border-[var(--color-line)] pt-2 text-xs">
          {detail?.sources?.length ? (
            <div>
              <div className="mb-0.5 text-[11px] font-medium text-[var(--color-muted)]">Quellen</div>
              {detail.sources.map((s) => <div key={s.id} className="flex items-center gap-1 text-[11px]">
                <span className={CONF_TONE[s.sourceQuality]}>●</span>
                {s.sourceUrl ? <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--color-gold)] hover:underline">{s.source || 'Quelle'}</a> : <span>{s.source}</span>}
                <span className="text-[var(--color-muted)]">· {CONFIDENCE_LABELS[s.sourceQuality]}</span>
              </div>)}
            </div>
          ) : null}
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-[var(--color-muted)]">Kontakt-/Sperrstatus</span>
            <select value={person.contactStatus} onChange={(e) => patch({ contactStatus: e.target.value as PersonContactStatus })} className="inp h-8 w-full text-xs">
              {Object.entries(PERSON_CONTACT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div>
            <div className="mb-0.5 flex items-center justify-between"><span className="text-[11px] font-medium text-[var(--color-muted)]">Interne Bemerkung</span>
              {noteEdit == null ? <button onClick={() => setNoteEdit(person.note || '')} className="btn-icon p-0.5"><Pencil size={12} /></button>
              : <button onClick={() => { patch({ note: noteEdit }); setNoteEdit(null) }} className="btn-icon p-0.5 text-green-600"><Check size={13} /></button>}
            </div>
            {noteEdit == null ? <p className="text-[11px] text-[var(--color-ink-soft)]">{person.note || <span className="text-[var(--color-muted)]">—</span>}</p>
            : <textarea value={noteEdit} onChange={(e) => setNoteEdit(e.target.value)} className="inp h-16 text-xs" />}
          </div>
        </div>
      )}
    </div>
  )
}

function PastePeopleModal({ companyId, onClose, onDone }: { companyId: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState('impressum')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true); setRes(null)
    try {
      const d = await api<{ ok: boolean; error?: string; people?: CompanyPerson[] }>('/api/kundenfinder/people/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, kind, companyId, persist: true }) })
      if (!d.ok) { setRes(d.error || 'Fehler'); return }
      setRes(`${d.people?.length ?? 0} Person(en) übernommen.`)
      setTimeout(onDone, 700)
    } finally { setBusy(false) }
  }
  return (
    <Modal onClose={onClose} title="Impressum-/Team-Text einfügen">
      <p className="text-xs text-[var(--color-muted)]">Nur geschäftlich veröffentlichten Text einfügen (z. B. Impressum). Es werden ausschließlich die enthaltenen Angaben ausgewertet – nichts erraten oder ergänzt.</p>
      <Fld label="Seitentyp"><select className="inp" value={kind} onChange={(e) => setKind(e.target.value)}><option value="impressum">Impressum</option><option value="team">Teamseite</option><option value="ueber_uns">Über uns</option><option value="kontakt">Kontakt</option></select></Fld>
      <textarea className="inp h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Geschäftsführer: Max Mustermann\nTelefon: 0221 …\nE-Mail: max.mustermann@…'} />
      {res && <p className="text-xs text-green-700">{res}</p>}
      <div className="flex justify-end gap-2"><button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">Schließen</button><button onClick={submit} disabled={busy || !text.trim()} className="btn-ink inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm">{busy && <RefreshCw size={14} className="animate-spin" />} Auswerten & übernehmen</button></div>
    </Modal>
  )
}

/* ─────────── kleine Helfer ─────────── */
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">{label}</span>{children}</label>
}
function Chk({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} /> {label}</label>
}
function Kpi({ label, v, tone }: { label: string; v: number; tone?: string }) {
  return <span className="inline-flex items-baseline gap-1.5"><span className={cls('font-display text-lg leading-none tabular-nums', tone)}>{v}</span><span className="text-xs text-[var(--color-muted)]">{label}</span></span>
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg space-y-3 rounded-2xl bg-[var(--color-paper)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-display text-lg">{title}</h3><button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-paper-2)]"><X size={17} /></button></div>
        {children}
      </div>
    </div>
  )
}
