/**
 * Reine (netz-freie) Extraktions- und Bewertungslogik für die Personen-/Entscheider-Recherche.
 *
 * Grundsätze (rechtlich/ethisch, fest verdrahtet):
 * - Es werden NUR Daten aus dem übergebenen, geschäftlich veröffentlichten Seitentext verarbeitet.
 * - Es werden KEINE Telefonnummern erraten und KEINE E-Mail-Adressen aus Namensmustern erzeugt.
 * - Jede Information trägt ihre Quelle (sourceUrl/sourceKind); ohne Quelle keine Speicherung.
 * - Eine Mobilnummer wird nie automatisch als „sicher geschäftlich“ dargestellt.
 */
import type { DecisionRelevance, ConfidenceLevel, PhoneType, MobileBusinessConfidence, ContactMethodKind } from '@shared/kundenfinder'
import { normalizePhone, normalizeEmail, isGermanMobile, isGenericEmail, splitPersonName } from './normalize'

/** Art der Quellseite (bestimmt die Quellenqualität). */
export type PageKind = 'impressum' | 'team' | 'ueber_uns' | 'kontakt' | 'startseite' | 'sonstige'

export interface PageInput {
  text: string
  links: { href: string; text?: string }[]
  sourceUrl: string
  kind: PageKind
}

export interface ExtractedContact {
  kind: ContactMethodKind
  phoneType?: PhoneType
  value: string
  normalizedValue: string
  isMobile: boolean
  isDirect: boolean
  mobileConfidence?: MobileBusinessConfidence
  sourceUrl: string
}

export interface ExtractedPerson {
  fullName: string
  salutation?: string
  title?: string
  firstName?: string
  lastName?: string
  role?: string
  roles: string[]
  department?: string
  isOwner: boolean
  isFounder: boolean
  isManagingDirector: boolean
  isShareholder: boolean
  isDecisionMaker: boolean
  decisionRelevance: DecisionRelevance
  decisionScore: number
  confidenceLevel: ConfidenceLevel
  sourceUrl: string
  contacts: ExtractedContact[]
}

export interface PageExtract {
  people: ExtractedPerson[]
  generalContacts: ExtractedContact[]
}

/* ─────────────────────────  Rollen → Entscheidungsrelevanz  ───────────────────────── */

interface RoleDef {
  re: RegExp
  canonical: string
  level: DecisionRelevance
  isOwner?: boolean
  isFounder?: boolean
  isManagingDirector?: boolean
  isShareholder?: boolean
  department?: string
}

/** Reihenfolge = Priorität (spezifischere/wichtigere Rollen zuerst). */
const ROLE_DEFS: RoleDef[] = [
  { re: /geschäftsführende[rn]?\s+gesellschafter(in)?/i, canonical: 'Geschäftsführender Gesellschafter', level: 'sehr_hoch', isManagingDirector: true, isShareholder: true },
  { re: /geschäftsführer(in)?|geschäftsführung/i, canonical: 'Geschäftsführer', level: 'sehr_hoch', isManagingDirector: true },
  { re: /(inhaber(in)?|eigentümer(in)?)/i, canonical: 'Inhaber', level: 'sehr_hoch', isOwner: true },
  { re: /praxisinhaber(in)?|praxisleitung|leitende[rn]?\s+(zahn)?arzt|zahnärztin/i, canonical: 'Praxisinhaber', level: 'sehr_hoch', isOwner: true },
  { re: /kanzleiinhaber(in)?|geschäftsführende[rn]?\s+(rechtsanwalt|rechtsanwältin|partner)/i, canonical: 'Kanzleiinhaber', level: 'sehr_hoch', isOwner: true },
  { re: /vorstand(svorsitzende[rn]?)?/i, canonical: 'Vorstand', level: 'sehr_hoch' },
  { re: /gründer(in)?|firmengründer(in)?/i, canonical: 'Gründer', level: 'sehr_hoch', isFounder: true },
  { re: /prokurist(in)?/i, canonical: 'Prokurist', level: 'hoch' },
  { re: /niederlassungsleiter(in)?|niederlassungsleitung/i, canonical: 'Niederlassungsleitung', level: 'hoch' },
  { re: /betriebsleiter(in)?|betriebsleitung/i, canonical: 'Betriebsleitung', level: 'hoch' },
  { re: /hoteldirektor(in)?|hoteldirektion/i, canonical: 'Hoteldirektion', level: 'hoch' },
  { re: /restaurantleiter(in)?|restaurantleitung/i, canonical: 'Restaurantleitung', level: 'hoch' },
  { re: /kaufmännische[rn]?\s+leit/i, canonical: 'Kaufmännische Leitung', level: 'hoch', department: 'Kaufmännisch' },
  { re: /marketingleiter(in)?|marketingleitung|leiter(in)?\s+marketing|leitung\s+marketing/i, canonical: 'Marketingleitung', level: 'hoch', department: 'Marketing' },
  { re: /(leiter(in)?|leitung)\s+(öffentlichkeitsarbeit|kommunikation|pr\b)/i, canonical: 'Leitung Kommunikation/PR', level: 'hoch', department: 'Kommunikation' },
  { re: /gesellschafter(in)?|teilhaber(in)?/i, canonical: 'Gesellschafter', level: 'hoch', isShareholder: true },
  { re: /partner(in)?\b/i, canonical: 'Partner', level: 'hoch' },
  { re: /assistenz\s+der\s+geschäftsführung|assistenz\s+gf/i, canonical: 'Assistenz der Geschäftsführung', level: 'mittel', department: 'Geschäftsleitung' },
  { re: /marketing(mitarbeiter(in)?)?|social\s?media/i, canonical: 'Marketing', level: 'mittel', department: 'Marketing' },
  { re: /(büro|office)[- ]?(management|organisation|leitung)?|verwaltung|sekretariat/i, canonical: 'Verwaltung/Büro', level: 'mittel', department: 'Verwaltung' },
  { re: /ansprechpartner(in)?|kontakt(person)?/i, canonical: 'Ansprechpartner', level: 'mittel' }
]

const RELEVANCE_SCORE: Record<DecisionRelevance, number> = { sehr_hoch: 100, hoch: 70, mittel: 40, unbekannt: 15 }

/**
 * Bewertet eine Rollenbezeichnung. Liefert Entscheidungsrelevanz + Rollen-Flags.
 * Erfindet niemals eine Rolle – unklare Angaben ergeben 'unbekannt'.
 */
export function roleRelevance(role?: string): {
  level: DecisionRelevance
  score: number
  canonical?: string
  isOwner: boolean
  isFounder: boolean
  isManagingDirector: boolean
  isShareholder: boolean
  isDecisionMaker: boolean
  department?: string
} {
  const base = { level: 'unbekannt' as DecisionRelevance, score: RELEVANCE_SCORE.unbekannt, isOwner: false, isFounder: false, isManagingDirector: false, isShareholder: false, isDecisionMaker: false, canonical: undefined as string | undefined, department: undefined as string | undefined }
  if (!role || !role.trim()) return base
  for (const d of ROLE_DEFS) {
    if (d.re.test(role)) {
      const level = d.level
      return {
        level,
        score: RELEVANCE_SCORE[level],
        canonical: d.canonical,
        isOwner: !!d.isOwner,
        isFounder: !!d.isFounder,
        isManagingDirector: !!d.isManagingDirector,
        isShareholder: !!d.isShareholder,
        isDecisionMaker: level === 'sehr_hoch' || level === 'hoch',
        department: d.department
      }
    }
  }
  return base
}

/** Alle in einem Textstück genannten (kanonischen) Rollen – ohne Duplikate. */
function rolesInText(s: string): string[] {
  const out: string[] = []
  for (const d of ROLE_DEFS) if (d.re.test(s) && !out.includes(d.canonical)) out.push(d.canonical)
  return out
}

/* ─────────────────────────  Telefon-Klassifizierung  ───────────────────────── */

/**
 * Klassifiziert eine Telefonnummer nach Typ + (bei Mobil) geschäftlicher Einschätzung.
 * `context` = umliegender Text/Label; `attachedToBusinessPerson` = Nummer steht bei einer
 * benannten geschäftlichen Entscheider-Rolle (z. B. Impressum-Geschäftsführer).
 */
export function classifyPhone(
  raw: string,
  opts: { context?: string; kind: PageKind; attachedToPerson?: boolean; personDecisionMaker?: boolean } = { kind: 'sonstige' }
): { value: string; normalized: string; phoneType: PhoneType; isMobile: boolean; isFax: boolean; isDirect: boolean; mobileConfidence?: MobileBusinessConfidence } {
  const normalized = normalizePhone(raw)
  const ctx = (opts.context || '').toLowerCase()
  const isFax = /\bfax\b|telefax|fax:/.test(ctx)
  const isMobile = isGermanMobile(normalized)
  const isDurchwahl = /durchwahl|\bdw\b|direkt(wahl|kontakt)|-\s?\d{1,4}\b/.test(ctx)

  if (isFax) return { value: raw.trim(), normalized, phoneType: 'fax', isMobile: false, isFax: true, isDirect: false }

  if (isMobile) {
    // Mobil: geschäftliche Einschätzung – bei Unsicherheit NIE „sicher geschäftlich“.
    let mobileConfidence: MobileBusinessConfidence
    if (opts.attachedToPerson && opts.personDecisionMaker && (opts.kind === 'impressum' || opts.kind === 'kontakt')) mobileConfidence = 'geschaeftlich'
    else if (/mobil|handy|geschäftlich/i.test(ctx) && opts.attachedToPerson) mobileConfidence = 'geschaeftlich'
    else if (opts.attachedToPerson) mobileConfidence = 'moeglicherweise'
    else mobileConfidence = 'allgemein'
    const phoneType: PhoneType = mobileConfidence === 'allgemein' ? 'allgemein_mobil' : 'geschaeftlich_mobil'
    return { value: raw.trim(), normalized, phoneType, isMobile: true, isFax: false, isDirect: !!opts.attachedToPerson, mobileConfidence }
  }

  if (isDurchwahl) return { value: raw.trim(), normalized, phoneType: 'durchwahl', isMobile: false, isFax: false, isDirect: true }
  if (opts.kind === 'impressum' || /zentrale/i.test(ctx)) return { value: raw.trim(), normalized, phoneType: 'zentrale', isMobile: false, isFax: false, isDirect: false }
  return { value: raw.trim(), normalized, phoneType: 'festnetz', isMobile: false, isFax: false, isDirect: false }
}

/** Quellenqualität je Seitentyp. */
export function sourceQualityFor(kind: PageKind): ConfidenceLevel {
  if (kind === 'impressum') return 'sehr_hoch'
  if (kind === 'team' || kind === 'ueber_uns' || kind === 'kontakt') return 'hoch'
  if (kind === 'startseite') return 'mittel'
  return 'mittel'
}

/* ─────────────────────────  Personen-Extraktion aus Seitentext  ───────────────────────── */

const CAP = '[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?'
const SP = '[ \\t]' // Wortabstand OHNE Zeilenumbruch – Namen dürfen keine Zeilen überspannen
const TITLE_PREFIX = `(?:(?:Prof\\.?|Dr\\.?(?:${SP}?med\\.?(?:${SP}?dent\\.?)?|${SP}?jur\\.?|${SP}?rer\\.?${SP}?nat\\.?)?|Dipl\\.?[-\\t ]?[A-Za-zÄÖÜäöü]+\\.?|Mag\\.?)${SP}+)*`
const PARTICLE = `(?:von|van|de|der|zu|den)${SP}+`
// Ein Personenname: optional Titel, 1–3 Vornamen/Partikel, Nachname (nur innerhalb einer Zeile).
const NAME = `(?:(?:Herr|Frau)${SP}+)?${TITLE_PREFIX}${CAP}(?:${SP}+(?:${PARTICLE})?${CAP}){1,3}`
const ROLE_ALT = ROLE_DEFS.map((d) => d.re.source).join('|')

// Benannte Gruppen, weil die Rollen-Regex interne Capture-Gruppen enthalten (Indizes würden sich verschieben).
const RE_ROLE_NAME = new RegExp(`(?<role>${ROLE_ALT})\\s*(?:[:\\-–]|\\bist\\b)?\\s+(?<name>${NAME})`, 'gi')
const RE_NAME_ROLE = new RegExp(`(?<name>${NAME})\\s*[,(\\-–]\\s*(?<role>${ROLE_ALT})`, 'gi')
const RE_VERTRETEN = /vertreten durch(?:\s+die\s+geschäftsführung)?\s*:?\s*/gi
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const RE_PHONE = /(?:\+49|0049|0)[\d\s()/.\-]{6,}\d/g

const BAD_NAME_WORDS = /(gmbh|mbh|kg|ohg|gbr|\bag\b|\bug\b|impressum|kontakt|datenschutz|telefon|mobil|straße|strasse|platz|deutschland|umsatzsteuer|handelsregister|amtsgericht|geschäftsführ|inhaber|vorstand|prokurist|gesellschaft|vertreten)/i

/** Prüft, ob ein gefundener „Name“ plausibel eine Person ist (kein Firmen-/Adressfragment). */
function looksLikePerson(name: string): boolean {
  const n = name.trim()
  if (n.length < 4 || n.length > 60) return false
  if (BAD_NAME_WORDS.test(n)) return false
  const words = n.replace(/(?:Herr|Frau|Prof\.?|Dr\.?|Dipl\.?[-\s]?\w+\.?|Mag\.?)/gi, '').trim().split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.length <= 4
}

interface RawPerson { name: string; role?: string; index: number }

function pushPerson(list: RawPerson[], name: string, role: string | undefined, index: number) {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!looksLikePerson(clean)) return
  const existing = list.find((p) => p.name.toLowerCase() === clean.toLowerCase())
  if (existing) {
    if (!existing.role && role) existing.role = role
  } else list.push({ name: clean, role, index })
}

/**
 * Extrahiert Personen (mit Rolle) und Kontaktmöglichkeiten aus einer geschäftlichen Seite.
 * Ordnet Kontaktdaten Personen über Namens-E-Mails und Textnähe zu; nicht zuordenbare
 * Kontakte gelten als allgemeine Unternehmenskontakte.
 */
export function extractPeopleFromPage(input: PageInput): PageExtract {
  const text = input.text || ''
  const raws: RawPerson[] = []

  // 1) "Rolle: Name"
  for (const m of text.matchAll(RE_ROLE_NAME)) {
    const roleStr = m.groups?.role || ''
    const nameStr = m.groups?.name
    if (!nameStr) continue
    const canonical = roleRelevance(roleStr).canonical || roleStr.trim()
    pushPerson(raws, nameStr, canonical, m.index ?? 0)
  }
  // 2) "Name (Rolle)" / "Name, Rolle"
  for (const m of text.matchAll(RE_NAME_ROLE)) {
    const nameStr = m.groups?.name
    if (!nameStr) continue
    const canonical = roleRelevance(m.groups?.role || '').canonical || undefined
    pushPerson(raws, nameStr, canonical, m.index ?? 0)
  }
  // 3) "Vertreten durch: <Name>" – Name direkt nach dem Marker (bis Zeilen-/Satzende)
  for (const m of text.matchAll(RE_VERTRETEN)) {
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 120)
    const nameM = after.match(new RegExp(`^\\s*(${NAME})`))
    if (nameM) {
      const tail = after.slice(nameM[0].length, nameM[0].length + 40)
      const roleM = tail.match(new RegExp(`(${ROLE_ALT})`, 'i'))
      const canonical = roleM ? roleRelevance(roleM[1]).canonical : 'Vertretungsberechtigt'
      pushPerson(raws, nameM[1], canonical, (m.index ?? 0) + m[0].length)
    }
  }

  // ── Kontaktdaten sammeln (mit Textposition für Näheanalyse) ──
  const emails: { value: string; index: number }[] = []
  for (const m of text.matchAll(RE_EMAIL)) emails.push({ value: m[0], index: m.index ?? 0 })
  for (const l of input.links) if (l.href?.toLowerCase().startsWith('mailto:')) {
    const v = decodeURIComponent(l.href.slice(7).split('?')[0])
    if (v && !emails.some((e) => e.value.toLowerCase() === v.toLowerCase())) emails.push({ value: v, index: -1 })
  }
  const phones: { value: string; index: number }[] = []
  for (const m of text.matchAll(RE_PHONE)) phones.push({ value: m[0], index: m.index ?? 0 })
  for (const l of input.links) if (l.href?.toLowerCase().startsWith('tel:')) {
    const v = l.href.slice(4)
    if (v && !phones.some((pp) => normalizePhone(pp.value) === normalizePhone(v))) phones.push({ value: v, index: -1 })
  }

  // ── Personen aufbauen ──
  const people: ExtractedPerson[] = raws.map((r) => {
    const nm = splitPersonName(r.name)
    const rr = roleRelevance(r.role)
    return {
      fullName: nm.fullName,
      salutation: nm.salutation,
      title: nm.title,
      firstName: nm.firstName,
      lastName: nm.lastName,
      role: r.role,
      roles: r.role ? [r.role] : [],
      department: rr.department,
      isOwner: rr.isOwner,
      isFounder: rr.isFounder,
      isManagingDirector: rr.isManagingDirector,
      isShareholder: rr.isShareholder,
      isDecisionMaker: rr.isDecisionMaker,
      decisionRelevance: rr.level,
      decisionScore: rr.score,
      confidenceLevel: sourceQualityFor(input.kind),
      sourceUrl: input.sourceUrl,
      contacts: []
    }
  })
  // Zeilenbereich jeder Person (Kontakte werden nur bei EINDEUTIGER Zeilennähe zugeordnet).
  const personLine = new Map<ExtractedPerson, [number, number]>()
  people.forEach((p, i) => {
    const idx = raws[i].index
    const start = text.lastIndexOf('\n', idx) + 1
    let end = text.indexOf('\n', idx)
    if (end < 0) end = text.length
    personLine.set(p, [start, end])
  })
  const personOnLine = (index: number): ExtractedPerson | undefined => {
    if (index < 0) return undefined
    for (const p of people) {
      const [s, e] = personLine.get(p)!
      if (index >= s && index <= e) return p
    }
    return undefined
  }
  const lineAround = (index: number): string => {
    if (index < 0) return ''
    const start = text.lastIndexOf('\n', index) + 1
    let end = text.indexOf('\n', index)
    if (end < 0) end = text.length
    return text.slice(start, end)
  }

  const generalContacts: ExtractedContact[] = []

  const attachEmail = (value: string, index: number) => {
    const norm = normalizeEmail(value)
    if (!norm) return
    const generic = isGenericEmail(norm)
    const local = norm.split('@')[0].toLowerCase()
    let target: ExtractedPerson | undefined
    // 1) Namens-E-Mail: nur ZUORDNEN anhand tatsächlich gefundener Namen (niemals erzeugen)
    if (!generic) {
      for (const p of people) {
        const ln = (p.lastName || '').toLowerCase()
        const fn = (p.firstName || '').split(' ')[0]?.toLowerCase() || ''
        if (ln.length >= 3 && local.includes(ln)) { target = p; break }
        if (fn.length >= 3 && ln.length >= 2 && local.includes(fn) && local.includes(ln)) { target = p; break }
        if (fn.length >= 4 && local === fn) { target = p; break }
      }
      // 2) sonst nur bei eindeutiger Zeilennähe
      if (!target) target = personOnLine(index)
    }
    const contact: ExtractedContact = { kind: 'email', value: norm, normalizedValue: norm, isMobile: false, isDirect: !!target && !generic, mobileConfidence: undefined, sourceUrl: input.sourceUrl }
    if (target && !generic) target.contacts.push(contact)
    else if (!generalContacts.some((g) => g.kind === 'email' && g.normalizedValue === norm)) generalContacts.push(contact)
  }

  const attachPhone = (value: string, index: number) => {
    const norm = normalizePhone(value)
    if (!norm) return
    const target = personOnLine(index) // Zuordnung nur bei gleicher Zeile
    const ctx = lineAround(index)
    const cl = classifyPhone(value, { context: ctx, kind: input.kind, attachedToPerson: !!target, personDecisionMaker: target?.isDecisionMaker })
    const contact: ExtractedContact = {
      kind: cl.isMobile ? 'mobile' : cl.phoneType === 'fax' ? 'fax' : 'phone',
      phoneType: cl.phoneType,
      value: cl.value,
      normalizedValue: cl.normalized,
      isMobile: cl.isMobile,
      isDirect: cl.isDirect,
      mobileConfidence: cl.mobileConfidence,
      sourceUrl: input.sourceUrl
    }
    if (cl.phoneType === 'fax') { // Fax nie als Haupttelefon einer Person
      if (!generalContacts.some((g) => g.normalizedValue === norm)) generalContacts.push(contact)
      return
    }
    if (target && (cl.isDirect || cl.isMobile)) target.contacts.push(contact)
    else if (!generalContacts.some((g) => g.normalizedValue === norm)) generalContacts.push(contact)
  }

  for (const e of emails) attachEmail(e.value, e.index)
  for (const pnum of phones) attachPhone(pnum.value, pnum.index)

  return { people, generalContacts }
}
