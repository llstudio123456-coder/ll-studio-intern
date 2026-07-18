import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type { Company, LeadCandidate, LeadStatus, SearchRun, WebsiteAnalysis, DupStatus } from '@shared/kundenfinder'
import { EXCLUDING_STATUSES } from '@shared/kundenfinder'
import { getDb } from './db'
import { normalizeCandidate, findDuplicate } from './duplicateDetection'
import { splitRechtsform } from './normalize'
import { contactCompleteness, acquisitionPriority, buildWebsiteNote } from './qualify'

const now = () => new Date().toISOString()
const jparse = <T>(s: unknown, d: T): T => {
  try {
    return s ? (JSON.parse(s as string) as T) : d
  } catch {
    return d
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToCompany(r: any): Company {
  return {
    id: r.id,
    name: r.name,
    nameNorm: r.name_norm || '',
    rechtsform: r.rechtsform || undefined,
    industry: r.industry || undefined,
    description: r.description || undefined,
    street: r.street || undefined,
    houseNumber: r.house_number || undefined,
    plz: r.plz || undefined,
    city: r.city || undefined,
    region: r.region || undefined,
    country: r.country || undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    website: r.website || undefined,
    domainNorm: r.domain_norm || undefined,
    phone: r.phone || undefined,
    phoneNorm: r.phone_norm || undefined,
    email: r.email || undefined,
    emailNorm: r.email_norm || undefined,
    contactName: r.contact_name || undefined,
    contactPosition: r.contact_position || undefined,
    contactEmail: r.contact_email || undefined,
    social: jparse(r.social, undefined),
    openingHours: r.opening_hours || undefined,
    rating: r.rating ?? undefined,
    ratingCount: r.rating_count ?? undefined,
    source: r.source || undefined,
    externalId: r.external_id || undefined,
    externalProvider: r.external_provider || undefined,
    status: (r.status || 'neu') as LeadStatus,
    priority: r.priority || undefined,
    assignee: r.assignee || undefined,
    tags: jparse(r.tags, undefined),
    nextStep: r.next_step || undefined,
    followupDate: r.followup_date || undefined,
    lastContactAt: r.last_contact_at || undefined,
    websiteScore: r.website_score ?? undefined,
    websiteReasons: jparse(r.website_reasons, undefined),
    leadScore: r.lead_score ?? undefined,
    leadLabel: r.lead_label || undefined,
    leadReasons: jparse(r.lead_reasons, undefined),
    contactCompleteness: r.contact_completeness || undefined,
    acquisitionPriority: r.acquisition_priority || undefined,
    acquisitionScore: r.acquisition_score ?? undefined,
    acquisitionReason: r.acquisition_reason || undefined,
    aiWebsiteNote: r.ai_website_note || undefined,
    aiNoteGeneratedAt: r.ai_note_generated_at || undefined,
    aiNoteEdited: !!r.ai_note_edited,
    lastActivityAt: r.last_activity_at || undefined,
    preferredPersonId: r.preferred_person_id || undefined,
    preferredPersonName: r.preferred_person_name || undefined,
    preferredPersonRole: r.preferred_person_role || undefined,
    decisionRelevance: r.decision_relevance || undefined,
    hasDecisionMaker: !!r.has_decision_maker,
    hasDirectPhone: !!r.has_direct_phone,
    hasBusinessMobile: !!r.has_business_mobile,
    hasDirectEmail: !!r.has_direct_email,
    peopleCount: r.people_count ?? undefined,
    peopleResearchedAt: r.people_researched_at || undefined,
    fingerprint: r.fingerprint || undefined,
    excluded: !!r.excluded,
    exclusionReason: r.exclusion_reason || undefined,
    saved: !!r.saved,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function getCompany(id: string): Company | null {
  const r = getDb().prepare('SELECT * FROM companies WHERE id = ?').get(id)
  return r ? rowToCompany(r) : null
}

function insertCompany(db: Database.Database, c: LeadCandidate, status: LeadStatus, saved: boolean): Company {
  const n = normalizeCandidate(c)
  const { rechtsform } = splitRechtsform(c.name)
  const id = randomUUID()
  const t = now()
  db.prepare(
    `INSERT INTO companies (id,name,name_norm,rechtsform,industry,description,street,house_number,plz,city,region,country,lat,lng,
      website,domain_norm,phone,phone_norm,email,email_norm,contact_name,contact_position,social,opening_hours,rating,rating_count,
      source,external_id,external_provider,status,tags,fingerprint,excluded,saved,created_at,updated_at)
     VALUES (@id,@name,@name_norm,@rechtsform,@industry,@description,@street,@house_number,@plz,@city,@region,@country,@lat,@lng,
      @website,@domain_norm,@phone,@phone_norm,@email,@email_norm,@contact_name,@contact_position,@social,@opening_hours,@rating,@rating_count,
      @source,@external_id,@external_provider,@status,@tags,@fingerprint,0,@saved,@created_at,@updated_at)`
  ).run({
    id,
    name: c.name,
    name_norm: n.nameNorm,
    rechtsform: rechtsform || null,
    industry: c.industry || null,
    description: null,
    street: c.street || null,
    house_number: c.houseNumber || null,
    plz: c.plz || null,
    city: c.city || null,
    region: c.region || null,
    country: c.country || 'Germany',
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    website: c.website || null,
    domain_norm: n.domainNorm || null,
    phone: c.phone || null,
    phone_norm: n.phoneNorm || null,
    email: c.email || null,
    email_norm: n.emailNorm || null,
    contact_name: c.contactName || null,
    contact_position: c.contactPosition || null,
    social: c.social ? JSON.stringify(c.social) : null,
    opening_hours: c.openingHours || null,
    rating: c.rating ?? null,
    rating_count: c.ratingCount ?? null,
    source: c.source || null,
    external_id: n.externalId || null,
    external_provider: n.externalProvider || null,
    status,
    tags: null,
    fingerprint: n.fp || null,
    saved: saved ? 1 : 0,
    created_at: t,
    updated_at: t
  })
  addSource(db, id, c)
  return getCompany(id)!
}

export function addSource(db: Database.Database, companyId: string, c: LeadCandidate) {
  db.prepare('INSERT INTO company_sources (company_id,source,source_url,external_id,provider,found_at) VALUES (?,?,?,?,?,?)').run(
    companyId,
    c.source || null,
    c.sourceUrl || null,
    c.externalId || null,
    c.externalProvider || null,
    now()
  )
}

export interface UpsertResult {
  dupStatus: DupStatus
  isNew: boolean
  companyId: string
  possibleDuplicateOf?: string
  excluded: boolean
  company: Company
}

/**
 * Fügt einen Kandidaten hinzu ODER erkennt ihn als bereits bekannt (Dubletten-Schutz).
 * - 'duplicate': existierendes Unternehmen wird zurückgegeben (KEIN neuer Lead)
 * - 'possible': neues Unternehmen wird angelegt, aber als „mögliche Dublette“ markiert
 * - 'new': neues Unternehmen
 */
export function upsertCandidate(c: LeadCandidate, opts?: { saved?: boolean; status?: LeadStatus }): UpsertResult {
  const db = getDb()
  const dup = findDuplicate(db, c)
  if (dup.status === 'duplicate' && dup.companyId) {
    const existing = getCompany(dup.companyId)!
    addSource(db, existing.id, c) // Quelle vermerken, aber KEIN neuer Lead
    return { dupStatus: 'duplicate', isNew: false, companyId: existing.id, excluded: existing.excluded || EXCLUDING_STATUSES.includes(existing.status), company: existing }
  }
  try {
    const company = insertCompany(db, c, opts?.status || 'neu', !!opts?.saved)
    return {
      dupStatus: dup.status === 'possible' ? 'possible' : 'new',
      isNew: true,
      companyId: company.id,
      possibleDuplicateOf: dup.status === 'possible' ? dup.companyId : undefined,
      excluded: false,
      company
    }
  } catch (e) {
    // UNIQUE-Constraint (Race/enge Dublette) → als Dublette behandeln, existierendes suchen
    if (e instanceof Error && /UNIQUE/i.test(e.message)) {
      const again = findDuplicate(db, c)
      if (again.companyId) {
        const existing = getCompany(again.companyId)!
        return { dupStatus: 'duplicate', isNew: false, companyId: existing.id, excluded: existing.excluded || EXCLUDING_STATUSES.includes(existing.status), company: existing }
      }
    }
    throw e
  }
}

export interface CompanyFilter {
  savedOnly?: boolean
  excludedOnly?: boolean
  status?: LeadStatus
  city?: string
  industry?: string
  minWebsiteScore?: number
  minLeadScore?: number
  hasEmail?: boolean
  hasPhone?: boolean
  hasWebsite?: boolean
  q?: string
  /* Phase 2 */
  contact?: 'vollstaendig' | 'teilweise' | 'keine' | 'unvollstaendig'
  priority?: 'A' | 'B' | 'C' | 'D'
  potentialMin?: number
  potentialMax?: number
  /* Personen-/Entscheider-Recherche */
  decider?: 'owner' | 'md' | 'marketing' | 'any' | 'preferred' | 'none'
  direct?: 'phone' | 'mobile' | 'email' | 'any' | 'general' | 'person_no_contact' | 'mobile_check'
  quality?: 'official' | 'high' | 'check' | 'conflict' | 'outdated'
  preset?: 'entscheider_direkt'
  sort?: 'prio' | 'website_bad' | 'website_good' | 'lead_high' | 'lead_low' | 'newest' | 'oldest' | 'name' | 'city' | 'contact' | 'updated'
  limit?: number
  offset?: number
}

const SORT_SQL: Record<NonNullable<CompanyFilter['sort']>, string> = {
  prio: "CASE acquisition_priority WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3 ELSE 4 END ASC, website_score DESC, updated_at DESC",
  website_bad: 'website_score DESC, updated_at DESC',
  website_good: 'website_score ASC, updated_at DESC',
  lead_high: 'lead_score DESC',
  lead_low: 'lead_score ASC',
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  name: 'name COLLATE NOCASE ASC',
  city: 'city COLLATE NOCASE ASC',
  contact: "CASE contact_completeness WHEN 'vollstaendig' THEN 0 WHEN 'teilweise' THEN 1 ELSE 2 END ASC, website_score DESC",
  updated: 'updated_at DESC'
}

export function listCompanies(f: CompanyFilter = {}): { rows: Company[]; total: number } {
  const db = getDb()
  const w: string[] = []
  const p: unknown[] = []
  if (f.savedOnly) w.push('saved = 1')
  if (f.excludedOnly) w.push('excluded = 1')
  if (f.status) { w.push('status = ?'); p.push(f.status) }
  if (f.city) { w.push('lower(city) = ?'); p.push(f.city.toLowerCase()) }
  if (f.industry) { w.push('industry = ?'); p.push(f.industry) }
  if (f.minWebsiteScore != null) { w.push('website_score >= ?'); p.push(f.minWebsiteScore) }
  if (f.potentialMin != null) { w.push('website_score >= ?'); p.push(f.potentialMin) }
  if (f.potentialMax != null) { w.push('website_score <= ?'); p.push(f.potentialMax) }
  if (f.minLeadScore != null) { w.push('lead_score >= ?'); p.push(f.minLeadScore) }
  if (f.hasEmail) w.push("email IS NOT NULL AND email <> ''")
  if (f.hasPhone) w.push("phone IS NOT NULL AND phone <> ''")
  if (f.hasWebsite === true) w.push("website IS NOT NULL AND website <> ''")
  if (f.hasWebsite === false) w.push("(website IS NULL OR website = '')")
  if (f.contact === 'unvollstaendig') w.push("(contact_completeness IS NULL OR contact_completeness <> 'vollstaendig')")
  else if (f.contact) { w.push('contact_completeness = ?'); p.push(f.contact) }
  if (f.priority) { w.push('acquisition_priority = ?'); p.push(f.priority) }
  // ── Entscheider-Filter (Rollups + EXISTS auf company_people) ──
  const personExists = (cond: string) => `EXISTS (SELECT 1 FROM company_people cp WHERE cp.company_id = companies.id AND ${cond})`
  if (f.decider === 'owner') w.push(personExists('cp.is_owner = 1'))
  else if (f.decider === 'md') w.push(personExists('cp.is_managing_director = 1'))
  else if (f.decider === 'marketing') w.push(personExists("lower(cp.role) LIKE '%marketing%'"))
  else if (f.decider === 'any') w.push('has_decision_maker = 1')
  else if (f.decider === 'preferred') w.push("preferred_person_id IS NOT NULL AND preferred_person_id <> ''")
  else if (f.decider === 'none') w.push('(has_decision_maker = 0 OR has_decision_maker IS NULL)')
  // ── Direktkontakt-Filter ──
  if (f.direct === 'phone') w.push('has_direct_phone = 1')
  else if (f.direct === 'mobile') w.push('has_business_mobile = 1')
  else if (f.direct === 'email') w.push('has_direct_email = 1')
  else if (f.direct === 'any') w.push('(has_direct_phone = 1 OR has_direct_email = 1 OR has_business_mobile = 1)')
  else if (f.direct === 'general') w.push('(COALESCE(has_direct_phone,0)=0 AND COALESCE(has_direct_email,0)=0 AND COALESCE(has_business_mobile,0)=0)')
  else if (f.direct === 'person_no_contact') w.push('has_decision_maker = 1 AND COALESCE(has_direct_phone,0)=0 AND COALESCE(has_direct_email,0)=0 AND COALESCE(has_business_mobile,0)=0')
  else if (f.direct === 'mobile_check') w.push(personExists("cp.id IN (SELECT person_id FROM person_contact_methods pcm WHERE pcm.mobile_confidence = 'moeglicherweise')"))
  // ── Quellenqualität-Filter ──
  if (f.quality === 'official') w.push(personExists("cp.confidence_level = 'sehr_hoch'"))
  else if (f.quality === 'high') w.push(personExists("cp.confidence_level IN ('sehr_hoch','hoch')"))
  else if (f.quality === 'check') w.push(personExists("cp.contact_status = 'daten_pruefen' OR cp.confidence_level = 'niedrig'"))
  else if (f.quality === 'conflict') w.push('EXISTS (SELECT 1 FROM person_data_conflicts pc WHERE pc.company_id = companies.id AND pc.resolved = 0)')
  else if (f.quality === 'outdated') w.push(personExists("cp.contact_status = 'veraltet'"))
  // ── Preset „Entscheider direkt erreichbar" ──
  if (f.preset === 'entscheider_direkt') {
    w.push('website_score >= 40')
    w.push("contact_completeness = 'vollstaendig'")
    w.push('has_decision_maker = 1')
    w.push('(has_direct_phone = 1 OR has_direct_email = 1 OR has_business_mobile = 1)')
  }
  if (f.q) {
    w.push('(lower(name) LIKE ? OR lower(city) LIKE ? OR lower(industry) LIKE ? OR domain_norm LIKE ? OR phone_norm LIKE ? OR email_norm LIKE ? OR lower(contact_name) LIKE ?)')
    const q = '%' + f.q.toLowerCase() + '%'
    p.push(q, q, q, q, q, q, q)
  }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : ''
  const order = SORT_SQL[f.sort || 'prio']
  const total = (db.prepare(`SELECT COUNT(*) c FROM companies ${where}`).get(...p) as { c: number }).c
  const rows = db
    .prepare(`SELECT * FROM companies ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...p, f.limit ?? 100, f.offset ?? 0)
    .map(rowToCompany)
  return { rows, total }
}

/** Kennzahlen für die Ergebnis-Kopfleiste. */
export function companyStats(base: CompanyFilter = {}): Record<string, number> {
  const db = getDb()
  const where: string[] = []
  const p: unknown[] = []
  if (base.excludedOnly) where.push('excluded = 1')
  else where.push('excluded = 0')
  if (base.savedOnly) where.push('saved = 1')
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const one = (extra: string) => (db.prepare(`SELECT COUNT(*) c FROM companies ${w}${w ? ' AND ' : 'WHERE '}${extra}`).get(...p) as { c: number }).c
  const gesamt = (db.prepare(`SELECT COUNT(*) c FROM companies ${w}`).get(...p) as { c: number }).c
  return {
    gesamt,
    qualifiziert: one("contact_completeness = 'vollstaendig'"),
    vollstaendig: one("contact_completeness = 'vollstaendig'"),
    nachrecherche: one("(contact_completeness IS NULL OR contact_completeness <> 'vollstaendig')"),
    hohesPotenzial: one('website_score >= 61'),
    gespeichert: one('saved = 1'),
    prioA: one("acquisition_priority = 'A'")
  }
}

export function updateCompany(id: string, patch: Partial<Company>, user = 'system'): Company | null {
  const db = getDb()
  const cur = getCompany(id)
  if (!cur) return null
  const map: Record<string, unknown> = {}
  const set: Record<string, keyof Company> = {
    status: 'status', priority: 'priority', assignee: 'assignee', next_step: 'nextStep', followup_date: 'followupDate',
    last_contact_at: 'lastContactAt', contact_name: 'contactName', contact_position: 'contactPosition', contact_email: 'contactEmail',
    phone: 'phone', email: 'email', website: 'website', description: 'description'
  }
  const cols: string[] = []
  for (const [col, key] of Object.entries(set)) {
    if (patch[key] !== undefined) {
      cols.push(`${col} = @${col}`)
      map[col] = patch[key] ?? null
    }
  }
  if (patch.tags !== undefined) { cols.push('tags = @tags'); map.tags = patch.tags ? JSON.stringify(patch.tags) : null }
  if (!cols.length && patch.status === undefined) return cur
  map.id = id
  map.updated_at = now()
  cols.push('updated_at = @updated_at')
  db.prepare(`UPDATE companies SET ${cols.join(', ')} WHERE id = @id`).run(map)
  if (patch.status && patch.status !== cur.status) {
    db.prepare('INSERT INTO status_history (company_id,from_status,to_status,user,at) VALUES (?,?,?,?,?)').run(id, cur.status, patch.status, user, now())
  }
  return getCompany(id)
}

export function saveCompany(id: string, dialog: Partial<Company>, user = 'system'): Company | null {
  const db = getDb()
  db.prepare('UPDATE companies SET saved = 1, updated_at = ? WHERE id = ?').run(now(), id)
  return updateCompany(id, dialog, user)
}

/**
 * Entfernt AUSSCHLIESSLICH den Speicherstatus („aus gespeicherten Kunden entfernen").
 *
 * Bewusst getrennt von removePermanently: Notizen, Kontaktverlauf, Pipeline-Status, Ansprechpartner
 * und alle sonstigen erfassten Daten bleiben vollständig erhalten. Das Unternehmen taucht danach
 * weiterhin als normaler Suchtreffer auf, nur nicht mehr unter „Gespeicherte Kunden".
 */
export function unsaveCompany(id: string): Company | null {
  getDb().prepare('UPDATE companies SET saved = 0, updated_at = ? WHERE id = ?').run(now(), id)
  return getCompany(id)
}

export function excludeCompany(id: string, reason: string, status: LeadStatus = 'nicht_geeignet', user = 'system'): Company | null {
  const db = getDb()
  const cur = getCompany(id)
  if (!cur) return null
  db.prepare('UPDATE companies SET excluded = 1, exclusion_reason = ?, status = ?, updated_at = ? WHERE id = ?').run(reason, status, now(), id)
  db.prepare('INSERT INTO exclusion_entries (company_id,reason,user,at) VALUES (?,?,?,?)').run(id, reason, user, now())
  if (status !== cur.status) db.prepare('INSERT INTO status_history (company_id,from_status,to_status,user,at) VALUES (?,?,?,?,?)').run(id, cur.status, status, user, now())
  return getCompany(id)
}

/** Vollständige Entfernung inkl. Dubletten-Schutz (geschützte Aktion). */
export function removePermanently(id: string): boolean {
  const db = getDb()
  const r = db.prepare('DELETE FROM companies WHERE id = ?').run(id)
  return r.changes > 0
}

export function addNote(companyId: string, content: string, author = 'user') {
  getDb().prepare('INSERT INTO notes (company_id,content,author,created_at) VALUES (?,?,?,?)').run(companyId, content, author, now())
}
export function listNotes(companyId: string) {
  return getDb().prepare('SELECT id,content,author,created_at as createdAt FROM notes WHERE company_id = ? ORDER BY id DESC').all(companyId)
}
export function listHistory(companyId: string) {
  return getDb().prepare('SELECT from_status as fromStatus,to_status as toStatus,user,at FROM status_history WHERE company_id = ? ORDER BY id DESC').all(companyId)
}

export function saveWebsiteAnalysis(companyId: string, a: WebsiteAnalysis) {
  const db = getDb()
  db.prepare('INSERT INTO website_analyses (company_id,url,reachable,https,score,breakdown,issues,screenshot,analyzed_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
    companyId,
    a.url,
    a.reachable ? 1 : 0,
    a.https ? 1 : 0,
    a.score,
    JSON.stringify(a.breakdown),
    JSON.stringify(a.issues),
    a.screenshot || null,
    a.analyzedAt
  )
  db.prepare('UPDATE companies SET website_score = ?, website_reasons = ?, updated_at = ? WHERE id = ?').run(a.score, JSON.stringify(a.issues), now(), companyId)
}
export function latestAnalysis(companyId: string) {
  return getDb().prepare('SELECT * FROM website_analyses WHERE company_id = ? ORDER BY id DESC LIMIT 1').get(companyId)
}

export function setLeadScore(companyId: string, score: number, label: string, reasons: string[]) {
  getDb().prepare('UPDATE companies SET lead_score = ?, lead_label = ?, lead_reasons = ?, updated_at = ? WHERE id = ?').run(score, label, JSON.stringify(reasons), now(), companyId)
}

/* ── Phase 2: Qualifizierung (Kontaktvollständigkeit, Akquise-Priorität, KI-Notiz) ── */
/** Berechnet Kontaktvollständigkeit + Akquise-Priorität; erzeugt KI-Notiz (nur wenn nicht manuell bearbeitet). */
export function qualifyCompany(id: string, opts?: { regenerateNote?: boolean }): Company | null {
  const db = getDb()
  const c = getCompany(id)
  if (!c) return null
  const cc = contactCompleteness(c)
  const prio = acquisitionPriority(c)
  const issues = (() => {
    const a = latestAnalysis(id) as { issues?: string } | undefined
    return a?.issues ? (jparse(a.issues, []) as string[]) : c.websiteReasons || []
  })()
  const keepManual = c.aiNoteEdited && !opts?.regenerateNote
  const note = keepManual ? c.aiWebsiteNote || '' : buildWebsiteNote(c, issues)
  db.prepare(
    `UPDATE companies SET contact_completeness=?, acquisition_priority=?, acquisition_score=?, acquisition_reason=?,
      ai_website_note=?, ai_note_generated_at=?, ai_note_edited=?, updated_at=? WHERE id=?`
  ).run(cc, prio.klasse, prio.score, prio.reason, note, keepManual ? c.aiNoteGeneratedAt || now() : now(), keepManual ? 1 : 0, now(), id)
  return getCompany(id)
}

/** Manuell bearbeitete KI-Notiz speichern (wird nicht automatisch überschrieben). */
export function setAiNote(id: string, note: string): Company | null {
  getDb().prepare('UPDATE companies SET ai_website_note=?, ai_note_edited=1, ai_note_generated_at=?, updated_at=? WHERE id=?').run(note, now(), now(), id)
  return getCompany(id)
}

/** Prioritäten/Notizen für alle (oder gefilterte) Unternehmen neu berechnen – ändert keine Analysedaten. */
export function recomputeAll(filter?: { savedOnly?: boolean }): { updated: number } {
  const db = getDb()
  const rows = db.prepare(`SELECT id FROM companies ${filter?.savedOnly ? 'WHERE saved = 1' : ''}`).all() as { id: string }[]
  const tx = db.transaction((ids: { id: string }[]) => {
    for (const r of ids) qualifyCompany(r.id)
  })
  tx(rows)
  return { updated: rows.length }
}

/* ── Kontaktaktivitäten ── */
export function addActivity(companyId: string, type: string, note?: string, nextStep?: string, followup?: string, user = 'user') {
  const db = getDb()
  db.prepare('INSERT INTO company_activities (company_id,type,note,next_step,followup,user,at) VALUES (?,?,?,?,?,?,?)').run(companyId, type, note || null, nextStep || null, followup || null, user, now())
  db.prepare('UPDATE companies SET last_activity_at=?, last_contact_at=?, updated_at=? WHERE id=?').run(now(), now(), now(), companyId)
}
export function listActivities(companyId: string) {
  return getDb().prepare('SELECT type,note,next_step as nextStep,followup,user,at FROM company_activities WHERE company_id=? ORDER BY id DESC').all(companyId)
}

/* ── Suchläufe ── */
export function createRun(id: string, params: Record<string, unknown>, area: string, industry: string, provider: string) {
  getDb().prepare('INSERT INTO search_runs (id,params,area,industry,provider,started_at,status) VALUES (?,?,?,?,?,?,?)').run(id, JSON.stringify(params), area, industry, provider, now(), 'laufend')
}
export function addRunResult(runId: string, companyId: string | null, isNew: boolean, dupStatus: string) {
  getDb().prepare('INSERT INTO search_results (run_id,company_id,is_new,dup_status,at) VALUES (?,?,?,?,?)').run(runId, companyId, isNew ? 1 : 0, dupStatus, now())
}
export function finishRun(id: string, stats: Partial<SearchRun>, status: SearchRun['status'] = 'fertig') {
  getDb().prepare('UPDATE search_runs SET finished_at=?,found=?,neu=?,duplicates=?,excluded=?,saved=?,errors=?,status=? WHERE id=?').run(
    now(),
    stats.found ?? 0,
    stats.neu ?? 0,
    stats.duplicates ?? 0,
    stats.excluded ?? 0,
    stats.saved ?? 0,
    JSON.stringify(stats.errors ?? []),
    status,
    id
  )
}
export function listRuns(limit = 50): SearchRun[] {
  const rows = getDb().prepare('SELECT * FROM search_runs ORDER BY started_at DESC LIMIT ?').all(limit)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return rows.map((r: any) => ({
    id: r.id,
    params: jparse(r.params, {}),
    area: r.area,
    industry: r.industry,
    provider: r.provider,
    startedAt: r.started_at,
    finishedAt: r.finished_at || undefined,
    found: r.found,
    neu: r.neu,
    duplicates: r.duplicates,
    excluded: r.excluded,
    saved: r.saved,
    errors: jparse(r.errors, []),
    status: r.status
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
