import { randomUUID } from 'crypto'
import type {
  CompanyPerson, PersonContactMethod, PersonSource, PersonDataConflict, PersonResearchRun,
  Company, DecisionRelevance, ConfidenceLevel, PersonContactStatus
} from '@shared/kundenfinder'
import { BLOCKING_PERSON_STATUSES } from '@shared/kundenfinder'
import { getDb } from './db'
import { getCompany } from './companiesRepo'
import { normalizePhone, normalizeEmail } from './normalize'
import type { ExtractedPerson, ExtractedContact } from './personExtract'
import { roleRelevance, sourceQualityFor } from './personExtract'
import type { ResearchResult } from './personResearch'

const now = () => new Date().toISOString()
const jparse = <T>(s: unknown, d: T): T => {
  try {
    return s ? (JSON.parse(s as string) as T) : d
  } catch {
    return d
  }
}
const CONF_RANK: Record<ConfidenceLevel, number> = { niedrig: 0, mittel: 1, hoch: 2, sehr_hoch: 3 }
const REL_RANK: Record<DecisionRelevance, number> = { unbekannt: 0, mittel: 1, hoch: 2, sehr_hoch: 3 }

/** Normalisierter Personenname für Dedupe innerhalb eines Unternehmens. */
function personNameNorm(full: string): string {
  return (full || '')
    .toLowerCase()
    .replace(/\b(herr|frau|prof\.?|dr\.?|dipl\.?[-\s]?\w*\.?|med\.?|dent\.?|jur\.?|mag\.?|m\.sc\.?|b\.sc\.?|ll\.m\.?)\b/g, ' ')
    .replace(/[^a-zäöüß ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToPerson(r: any): CompanyPerson {
  return {
    id: r.id,
    companyId: r.company_id,
    fullName: r.full_name,
    salutation: r.salutation || undefined,
    firstName: r.first_name || undefined,
    lastName: r.last_name || undefined,
    title: r.title || undefined,
    role: r.role || undefined,
    roles: jparse(r.roles, [] as string[]),
    department: r.department || undefined,
    isOwner: !!r.is_owner,
    isFounder: !!r.is_founder,
    isManagingDirector: !!r.is_managing_director,
    isShareholder: !!r.is_shareholder,
    isDecisionMaker: !!r.is_decision_maker,
    decisionRelevance: (r.decision_relevance || 'unbekannt') as DecisionRelevance,
    decisionScore: r.decision_score ?? 0,
    isPreferredContact: !!r.is_preferred_contact,
    confidenceLevel: (r.confidence_level || 'mittel') as ConfidenceLevel,
    contactStatus: (r.contact_status || 'zu_pruefen') as PersonContactStatus,
    note: r.note || undefined,
    noteEdited: !!r.note_edited,
    source: r.source || undefined,
    sourceUrl: r.source_url || undefined,
    firstSeenAt: r.first_seen_at,
    lastVerifiedAt: r.last_verified_at || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}
function rowToContact(r: any): PersonContactMethod {
  return {
    id: r.id,
    personId: r.person_id,
    companyId: r.company_id,
    kind: r.kind,
    phoneType: r.phone_type || undefined,
    value: r.value,
    normalizedValue: r.normalized_value || undefined,
    isDirect: !!r.is_direct,
    isMobile: !!r.is_mobile,
    isBusinessPublished: !!r.is_business_published,
    mobileConfidence: r.mobile_confidence || undefined,
    isPreferred: !!r.is_preferred,
    source: r.source || undefined,
    sourceUrl: r.source_url || undefined,
    verifiedAt: r.verified_at || undefined,
    verificationStatus: r.verification_status || undefined,
    createdAt: r.created_at
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function listContacts(personId: string): PersonContactMethod[] {
  return getDb().prepare('SELECT * FROM person_contact_methods WHERE person_id = ? ORDER BY id').all(personId).map(rowToContact)
}
export function listPersonSources(personId: string): PersonSource[] {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return getDb().prepare('SELECT * FROM person_sources WHERE person_id = ? ORDER BY id DESC').all(personId).map((r: any) => ({
    id: r.id, personId: r.person_id, source: r.source, sourceUrl: r.source_url || undefined, sourceQuality: r.source_quality, snippet: r.snippet || undefined, foundAt: r.found_at
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Person mit Kontaktmethoden + Quellen laden. */
export function getPerson(id: string): CompanyPerson | null {
  const r = getDb().prepare('SELECT * FROM company_people WHERE id = ?').get(id)
  if (!r) return null
  const p = rowToPerson(r)
  p.contacts = listContacts(id)
  p.sources = listPersonSources(id)
  return p
}

/** Alle Personen eines Unternehmens (inkl. Kontaktmethoden), bevorzugter zuerst. */
export function listPeople(companyId: string): CompanyPerson[] {
  const rows = getDb().prepare('SELECT * FROM company_people WHERE company_id = ? ORDER BY is_preferred_contact DESC, decision_score DESC, full_name').all(companyId)
  return rows.map((r) => {
    const p = rowToPerson(r)
    p.contacts = listContacts(p.id)
    return p
  })
}

/**
 * Fügt eine (extrahierte) Person hinzu oder ergänzt eine bereits bekannte (Dedupe je Unternehmen).
 * Manuell bearbeitete Notizen und der Kontaktstatus bleiben unangetastet.
 */
export function upsertPerson(companyId: string, ex: ExtractedPerson): string {
  const db = getDb()
  const nameNorm = personNameNorm(ex.fullName)
  const t = now()
  const existing = nameNorm
    ? (db.prepare('SELECT * FROM company_people WHERE company_id = ? AND name_norm = ? LIMIT 1').get(companyId, nameNorm) as Record<string, unknown> | undefined)
    : undefined

  let personId: string
  if (existing) {
    personId = existing.id as string
    const cur = rowToPerson(existing)
    const roles = Array.from(new Set([...(cur.roles || []), ...ex.roles].filter(Boolean)))
    // Rolle nur „hochstufen", niemals eine bessere durch eine schwächere ersetzen
    const better = ex.decisionScore > cur.decisionScore
    const role = better && ex.role ? ex.role : cur.role || ex.role
    const rr = roleRelevance(role)
    const confidence = CONF_RANK[ex.confidenceLevel] > CONF_RANK[cur.confidenceLevel] ? ex.confidenceLevel : cur.confidenceLevel
    db.prepare(
      `UPDATE company_people SET role=?, roles=?, department=COALESCE(department,?), title=COALESCE(title,?),
        first_name=COALESCE(first_name,?), last_name=COALESCE(last_name,?), salutation=COALESCE(salutation,?),
        is_owner=?, is_founder=?, is_managing_director=?, is_shareholder=?, is_decision_maker=?,
        decision_relevance=?, decision_score=?, confidence_level=?, last_verified_at=?, updated_at=? WHERE id=?`
    ).run(
      role || null, JSON.stringify(roles), ex.department || null, ex.title || null,
      ex.firstName || null, ex.lastName || null, ex.salutation || null,
      (cur.isOwner || rr.isOwner) ? 1 : 0, (cur.isFounder || rr.isFounder) ? 1 : 0, (cur.isManagingDirector || rr.isManagingDirector) ? 1 : 0,
      (cur.isShareholder || rr.isShareholder) ? 1 : 0, rr.isDecisionMaker ? 1 : 0,
      rr.level, Math.max(cur.decisionScore, rr.score), confidence, t, t, personId
    )
  } else {
    personId = randomUUID()
    const rr = roleRelevance(ex.role)
    db.prepare(
      `INSERT INTO company_people (id,company_id,full_name,name_norm,salutation,first_name,last_name,title,role,roles,department,
        is_owner,is_founder,is_managing_director,is_shareholder,is_decision_maker,decision_relevance,decision_score,
        is_preferred_contact,confidence_level,contact_status,source,source_url,first_seen_at,last_verified_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?)`
    ).run(
      personId, companyId, ex.fullName, nameNorm, ex.salutation || null, ex.firstName || null, ex.lastName || null, ex.title || null,
      ex.role || null, JSON.stringify(ex.roles), ex.department || null,
      rr.isOwner ? 1 : 0, rr.isFounder ? 1 : 0, rr.isManagingDirector ? 1 : 0, rr.isShareholder ? 1 : 0, rr.isDecisionMaker ? 1 : 0,
      ex.decisionRelevance, ex.decisionScore, ex.confidenceLevel, 'zu_pruefen', ex.role || null, ex.sourceUrl || null, t, t, t, t
    )
  }
  // Quelle vermerken
  db.prepare('INSERT INTO person_sources (person_id,source,source_url,source_quality,snippet,found_at) VALUES (?,?,?,?,?,?)').run(
    personId, ex.role || 'Recherche', ex.sourceUrl || null, ex.confidenceLevel, (ex.role ? `${ex.role}: ` : '') + ex.fullName, t
  )
  for (const cm of ex.contacts) addContactMethod(personId, companyId, cm)
  return personId
}

/** Kontaktmethode (dedupliziert) hinzufügen. Fax nie als Direktkontakt. */
export function addContactMethod(personId: string, companyId: string, cm: ExtractedContact) {
  const db = getDb()
  const normalized = cm.kind === 'email' ? normalizeEmail(cm.value) : normalizePhone(cm.value)
  if (!normalized) return
  try {
    db.prepare(
      `INSERT INTO person_contact_methods (person_id,company_id,kind,phone_type,value,normalized_value,is_direct,is_mobile,is_business_published,mobile_confidence,is_preferred,source,source_url,verification_status,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`
    ).run(
      personId, companyId, cm.kind, cm.phoneType || null, cm.value, normalized,
      cm.isDirect ? 1 : 0, cm.isMobile ? 1 : 0, 1 /* aus geschäftlich veröffentlichter Quelle */, cm.mobileConfidence || null,
      'recherche', cm.sourceUrl || null, 'unbestaetigt', now()
    )
  } catch (e) {
    // UNIQUE (bereits vorhanden) → ignorieren, kein Duplikat
    if (!(e instanceof Error && /UNIQUE/i.test(e.message))) throw e
  }
}

/** Bevorzugten Kontakt einer Person markieren (je Kind höchstens einer). */
function markPreferredContacts(personId: string) {
  const db = getDb()
  const contacts = listContacts(personId)
  db.prepare('UPDATE person_contact_methods SET is_preferred = 0 WHERE person_id = ?').run(personId)
  const pref = (kind: string, pick: (c: PersonContactMethod) => number) => {
    const cand = contacts.filter((c) => (kind === 'phone' ? c.kind === 'phone' || c.kind === 'mobile' : c.kind === kind))
    if (!cand.length) return
    cand.sort((a, b) => pick(b) - pick(a))
    db.prepare('UPDATE person_contact_methods SET is_preferred = 1 WHERE id = ?').run(cand[0].id)
  }
  pref('email', (c) => (c.isDirect ? 2 : 1))
  // Telefon: geschäftl. Mobil/Durchwahl bevorzugt, Fax nie
  pref('phone', (c) => (c.phoneType === 'fax' ? -1 : c.phoneType === 'geschaeftlich_mobil' ? 3 : c.isDirect ? 2 : 1))
}

/* ─────────────────────────  Bevorzugter Ansprechpartner + Rollups  ───────────────────────── */

function roleRank(p: CompanyPerson): number {
  if (p.isOwner) return 60
  if (p.isManagingDirector) return 55
  if (p.isFounder && p.isDecisionMaker) return 52
  if (/marketing/i.test(p.role || '') && p.isDecisionMaker) return 42
  if (/betriebsleit|niederlassungsleit/i.test(p.role || '')) return 38
  if (p.isDecisionMaker) return 34
  if (p.decisionRelevance === 'mittel') return 18
  return 8
}

/** Wählt den bevorzugten Ansprechpartner (gesperrte Personen ausgenommen) + liefert Begründung. */
export function pickPreferredPerson(people: CompanyPerson[]): { person?: CompanyPerson; reason: string } {
  const eligible = people.filter((p) => !BLOCKING_PERSON_STATUSES.includes(p.contactStatus))
  if (!eligible.length) return { reason: 'Kein kontaktierbarer Ansprechpartner identifiziert.' }
  const scored = eligible.map((p) => {
    const contacts = p.contacts || []
    const directEmail = contacts.some((c) => c.kind === 'email' && c.isDirect)
    const directPhone = contacts.some((c) => (c.kind === 'phone' || c.kind === 'mobile') && c.isDirect)
    const bizMobile = contacts.some((c) => c.isMobile && (c.mobileConfidence === 'geschaeftlich' || c.mobileConfidence === 'moeglicherweise'))
    const score = roleRank(p) + (directEmail ? 15 : 0) + (directPhone ? 12 : 0) + (bizMobile ? 10 : 0) + CONF_RANK[p.confidenceLevel] * 3
    return { p, score, directEmail, directPhone, bizMobile }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]
  const rolle = top.p.role || 'Ansprechpartner'
  let reason: string
  if (top.directEmail || top.directPhone || top.bizMobile) {
    const wege: string[] = []
    if (top.directPhone || top.bizMobile) wege.push('direkter geschäftlicher Telefonnummer')
    if (top.directEmail) wege.push('geschäftlicher E-Mail-Adresse')
    reason = `Bevorzugter Ansprechpartner, da als ${rolle} genannt und mit ${wege.join(' und ')} veröffentlicht.`
  } else {
    reason = `Als ${rolle} identifiziert. Es wurde keine direkte Kontaktmöglichkeit gefunden, daher wird der allgemeine Unternehmenskontakt verwendet.`
  }
  return { person: top.p, reason }
}

/** Aktualisiert die denormalisierten Rollup-Spalten des Unternehmens aus den Personen. */
export function recomputeCompanyRollup(companyId: string): { preferred?: CompanyPerson; reason: string } {
  const db = getDb()
  const people = listPeople(companyId)
  for (const p of people) markPreferredContacts(p.id)
  const pick = pickPreferredPerson(people)

  db.prepare('UPDATE company_people SET is_preferred_contact = 0 WHERE company_id = ?').run(companyId)
  if (pick.person) db.prepare('UPDATE company_people SET is_preferred_contact = 1 WHERE id = ?').run(pick.person.id)

  const active = people.filter((p) => !BLOCKING_PERSON_STATUSES.includes(p.contactStatus))
  const bestRel = active.reduce<DecisionRelevance>((acc, p) => (REL_RANK[p.decisionRelevance] > REL_RANK[acc] ? p.decisionRelevance : acc), 'unbekannt')
  const hasDecisionMaker = active.some((p) => p.isDecisionMaker)
  const allContacts = active.flatMap((p) => p.contacts || [])
  const hasDirectEmail = allContacts.some((c) => c.kind === 'email' && c.isDirect)
  const hasBusinessMobile = allContacts.some((c) => c.isMobile && (c.mobileConfidence === 'geschaeftlich' || c.mobileConfidence === 'moeglicherweise'))
  const hasDirectPhone = allContacts.some((c) => (c.kind === 'phone' || c.kind === 'mobile') && c.isDirect) || hasBusinessMobile

  db.prepare(
    `UPDATE companies SET preferred_person_id=?, preferred_person_name=?, preferred_person_role=?, decision_relevance=?,
      has_decision_maker=?, has_direct_phone=?, has_business_mobile=?, has_direct_email=?, people_count=?, updated_at=? WHERE id=?`
  ).run(
    pick.person?.id || null, pick.person?.fullName || null, pick.person?.role || null, bestRel,
    hasDecisionMaker ? 1 : 0, hasDirectPhone ? 1 : 0, hasBusinessMobile ? 1 : 0, hasDirectEmail ? 1 : 0, people.length, now(), companyId
  )
  return pick
}

/* ─────────────────────────  Recherchelauf persistieren  ───────────────────────── */

export function persistResearch(companyId: string, res: ResearchResult): { people: number; contacts: number; runId: string } {
  const db = getDb()
  const runId = randomUUID()
  const startedAt = now()
  db.prepare('INSERT INTO person_research_runs (id,company_id,started_at,pages_checked,status,log) VALUES (?,?,?,?,?,?)').run(
    runId, companyId, startedAt, JSON.stringify(res.pagesChecked), 'laufend', JSON.stringify(res.log)
  )

  let peopleCount = 0
  let contactCount = 0
  const tx = db.transaction(() => {
    for (const pr of res.results) {
      for (const ex of pr.extract.people) {
        upsertPerson(companyId, ex)
        peopleCount++
        contactCount += ex.contacts.length
      }
    }
  })
  tx()
  contactCount += res.results.reduce((n, r) => n + r.extract.generalContacts.length, 0)

  db.prepare('UPDATE person_research_runs SET finished_at=?, people_found=?, contacts_found=?, status=? WHERE id=?').run(
    now(), peopleCount, contactCount, 'fertig', runId
  )
  db.prepare('UPDATE companies SET people_researched_at=? WHERE id=?').run(now(), companyId)
  recomputeCompanyRollup(companyId)
  return { people: peopleCount, contacts: contactCount, runId }
}

/* ─────────────────────────  Manuelle Bearbeitung / Sperrstatus  ───────────────────────── */

export function updatePerson(id: string, patch: Partial<CompanyPerson>): CompanyPerson | null {
  const db = getDb()
  const cur = getPerson(id)
  if (!cur) return null
  const cols: string[] = []
  const map: Record<string, unknown> = { id }
  const setStr = (col: string, val: unknown) => { cols.push(`${col} = @${col}`); map[col] = val ?? null }
  if (patch.fullName !== undefined) { setStr('full_name', patch.fullName); setStr('name_norm', personNameNorm(patch.fullName)) }
  if (patch.role !== undefined) {
    setStr('role', patch.role)
    const rr = roleRelevance(patch.role)
    setStr('decision_relevance', rr.level); setStr('decision_score', rr.score)
    setStr('is_owner', rr.isOwner ? 1 : 0); setStr('is_managing_director', rr.isManagingDirector ? 1 : 0)
    setStr('is_founder', rr.isFounder ? 1 : 0); setStr('is_shareholder', rr.isShareholder ? 1 : 0)
    setStr('is_decision_maker', rr.isDecisionMaker ? 1 : 0)
  }
  if (patch.department !== undefined) setStr('department', patch.department)
  if (patch.note !== undefined) { setStr('note', patch.note); setStr('note_edited', 1) }
  if (patch.contactStatus !== undefined) setStr('contact_status', patch.contactStatus)
  if (patch.confidenceLevel !== undefined) setStr('confidence_level', patch.confidenceLevel)
  if (!cols.length) return cur
  setStr('updated_at', now())
  db.prepare(`UPDATE company_people SET ${cols.join(', ')} WHERE id = @id`).run(map)
  recomputeCompanyRollup(cur.companyId)
  return getPerson(id)
}

/**
 * Kontaktstatus setzen (Datenschutz). Bei „Kein Kontakt gewünscht" o. Ä. bleibt die Person als
 * minimaler Sperreintrag erhalten (nicht erneut aufnehmen), erscheint aber nicht mehr als aktive Kontaktoption.
 */
export function setPersonContactStatus(id: string, status: PersonContactStatus): CompanyPerson | null {
  return updatePerson(id, { contactStatus: status })
}

export function addConflict(companyId: string, field: string, valueA: string, valueB: string, sourceA?: string, sourceB?: string) {
  getDb().prepare('INSERT INTO person_data_conflicts (company_id,field,value_a,value_b,source_a,source_b,at) VALUES (?,?,?,?,?,?,?)').run(
    companyId, field, valueA, valueB, sourceA || null, sourceB || null, now()
  )
}
export function listConflicts(companyId: string): PersonDataConflict[] {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return getDb().prepare('SELECT * FROM person_data_conflicts WHERE company_id = ? AND resolved = 0 ORDER BY id DESC').all(companyId).map((r: any) => ({
    id: r.id, companyId: r.company_id, personId: r.person_id || undefined, field: r.field, valueA: r.value_a, valueB: r.value_b, sourceA: r.source_a || undefined, sourceB: r.source_b || undefined, resolved: !!r.resolved, at: r.at
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function listResearchRuns(companyId: string): PersonResearchRun[] {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return getDb().prepare('SELECT * FROM person_research_runs WHERE company_id = ? ORDER BY started_at DESC LIMIT 10').all(companyId).map((r: any) => ({
    id: r.id, companyId: r.company_id, startedAt: r.started_at, finishedAt: r.finished_at || undefined,
    pagesChecked: jparse(r.pages_checked, []), peopleFound: r.people_found ?? 0, contactsFound: r.contacts_found ?? 0, status: r.status, log: jparse(r.log, [])
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/* ─────────────────────────  KI-Zusammenfassung (nur belegte Fakten)  ───────────────────────── */

/** Kurze interne Zusammenfassung – ausschließlich aus gespeicherten, belegten Informationen. */
export function buildPeopleSummary(company: Company, people: CompanyPerson[]): string {
  const active = people.filter((p) => !BLOCKING_PERSON_STATUSES.includes(p.contactStatus))
  if (!active.length) {
    if (company.peopleResearchedAt) return `Für ${company.name} wurde bislang kein geschäftlicher Ansprechpartner aus öffentlichen Quellen identifiziert. Für die Kontaktaufnahme steht nur der allgemeine Unternehmenskontakt zur Verfügung.`
    return 'Es wurde noch keine Personenrecherche durchgeführt.'
  }
  const pick = pickPreferredPerson(active)
  const p = pick.person!
  const anrede = p.salutation === 'Frau' ? 'Sie' : p.salutation === 'Herr' ? 'Er' : 'Die Person'
  const rolle = p.role || 'Ansprechpartner/in'
  const quelle = (() => {
    const u = p.sourceUrl || ''
    if (/impressum/i.test(u)) return 'im Impressum'
    if (/team|mitarbeiter|ansprechpartner/i.test(u)) return 'auf der Teamseite'
    if (/kontakt|contact/i.test(u)) return 'auf der Kontaktseite'
    if (/ueber|über|about|unternehmen/i.test(u)) return 'auf der Über-uns-Seite'
    return 'auf der Unternehmenswebsite'
  })()
  const contacts = p.contacts || []
  const mobil = contacts.find((c) => c.isMobile && (c.mobileConfidence === 'geschaeftlich' || c.mobileConfidence === 'moeglicherweise'))
  const mail = contacts.find((c) => c.kind === 'email' && c.isDirect)
  const geprueft = company.peopleResearchedAt ? new Date(company.peopleResearchedAt).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')

  let kontaktSatz: string
  if (mobil) kontaktSatz = `Eine ${mobil.mobileConfidence === 'geschaeftlich' ? 'geschäftliche' : 'möglicherweise geschäftliche'} Mobilnummer wurde ${quelle} veröffentlicht.`
  else if (mail) kontaktSatz = `Eine geschäftliche E-Mail-Adresse wurde ${quelle} veröffentlicht.`
  else kontaktSatz = 'Es wurden keine direkten geschäftlichen Kontaktdaten gefunden; für die Kontaktaufnahme steht nur der allgemeine Unternehmenskontakt zur Verfügung.'

  return `Als wahrscheinlich zuständige Person wurde ${p.fullName} identifiziert. ${anrede} wird ${quelle} als ${rolle} genannt. ${kontaktSatz} Die Angaben wurden zuletzt am ${geprueft} geprüft.`
}
