/* ─────────────────────────  KUNDENFINDER (Lead-CRM) — Typen  ───────────────────────── */

export type LeadStatus =
  | 'neu' // Neu gefunden
  | 'pruefen' // Muss geprüft werden
  | 'interessant'
  | 'kontakt_vorbereiten'
  | 'kontaktiert'
  | 'rueckmeldung_ausstehend'
  | 'wiedervorlage'
  | 'vorschlag_geplant'
  | 'vorschlag_erstellt'
  | 'vorschlag_versendet'
  | 'gespraech'
  | 'angebot_versendet'
  | 'kunde'
  | 'abgelehnt'
  | 'nicht_erreichbar'
  | 'nicht_geeignet'
  | 'kein_kontakt'

/** Status, die ein Unternehmen dauerhaft von neuen Vorschlägen ausschließen. */
export const EXCLUDING_STATUSES: LeadStatus[] = ['kunde', 'abgelehnt', 'nicht_geeignet', 'kein_kontakt']

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  neu: 'Neu gefunden',
  pruefen: 'Muss geprüft werden',
  interessant: 'Interessant',
  kontakt_vorbereiten: 'Kontakt vorbereiten',
  kontaktiert: 'Kontakt aufgenommen',
  rueckmeldung_ausstehend: 'Rückmeldung ausstehend',
  wiedervorlage: 'Wiedervorlage',
  vorschlag_geplant: 'Website-Vorschlag geplant',
  vorschlag_erstellt: 'Vorschlag erstellt',
  vorschlag_versendet: 'Vorschlag versendet',
  gespraech: 'Gespräch vereinbart',
  angebot_versendet: 'Angebot versendet',
  kunde: 'Kunde gewonnen',
  abgelehnt: 'Abgelehnt',
  nicht_erreichbar: 'Nicht erreichbar',
  nicht_geeignet: 'Nicht geeignet',
  kein_kontakt: 'Kein Kontakt gewünscht'
}

export type LeadPriority = 'hoch' | 'mittel' | 'niedrig'
export type DupStatus = 'new' | 'duplicate' | 'possible'

/** Roh-Kandidat aus einer Datenquelle (vor dem Speichern). */
export interface LeadCandidate {
  name: string
  industry?: string
  street?: string
  houseNumber?: string
  plz?: string
  city?: string
  region?: string
  country?: string
  lat?: number
  lng?: number
  website?: string
  phone?: string
  email?: string
  contactName?: string
  contactPosition?: string
  openingHours?: string
  social?: Record<string, string>
  rating?: number
  ratingCount?: number
  source: string // z. B. 'osm', 'manuell', 'csv'
  sourceUrl?: string
  externalId?: string // z. B. 'osm/node/123'
  externalProvider?: string // z. B. 'osm'
}

export interface WebsiteAnalysis {
  url: string
  reachable: boolean
  https: boolean
  score: number // 0..100 Verbesserungs-POTENZIAL (hoch = schlechte Website)
  breakdown: { technik: number; mobile: number; performance: number; design: number; inhalt: number; aktualitaet: number }
  issues: string[]
  hasWebsite: boolean
  loadMs?: number
  screenshot?: string
  analyzedAt: string
  /** Automatisch erkannter Website-Zustand (leer/geparkt/… vs. vorhanden) — siehe @shared/websiteState. */
  state?: string
  stateReason?: string
}

export interface LeadScore {
  score: number // 0..100 (hoch = interessanter Lead)
  label: 'sehr interessant' | 'interessant' | 'eventuell interessant' | 'geringe priorität' | 'nicht geeignet'
  reasons: string[]
}

export interface Company {
  id: string
  name: string
  nameNorm: string
  rechtsform?: string
  industry?: string
  description?: string
  street?: string
  houseNumber?: string
  plz?: string
  city?: string
  region?: string
  country?: string
  lat?: number
  lng?: number
  website?: string
  domainNorm?: string
  phone?: string
  phoneNorm?: string
  email?: string
  emailNorm?: string
  contactName?: string
  contactPosition?: string
  contactEmail?: string
  social?: Record<string, string>
  openingHours?: string
  rating?: number
  ratingCount?: number
  source?: string
  externalId?: string
  externalProvider?: string
  status: LeadStatus
  priority?: LeadPriority
  assignee?: string
  tags?: string[]
  nextStep?: string
  followupDate?: string
  lastContactAt?: string
  websiteScore?: number
  websiteReasons?: string[]
  /** Effektiver Website-Zustand (manuelle Korrektur hat Vorrang, siehe @shared/websiteState). */
  websiteState?: string
  websiteStateReason?: string
  websiteStateAuto?: string
  websiteStateManual?: string
  leadScore?: number
  leadLabel?: string
  leadReasons?: string[]
  /* Phase 2: Qualifizierung */
  contactCompleteness?: 'vollstaendig' | 'teilweise' | 'keine'
  acquisitionPriority?: 'A' | 'B' | 'C' | 'D'
  acquisitionScore?: number
  acquisitionReason?: string
  aiWebsiteNote?: string
  aiNoteGeneratedAt?: string
  aiNoteEdited?: boolean
  lastActivityAt?: string
  /* Personen-/Entscheider-Recherche (denormalisierte Rollups für Liste & Filter) */
  preferredPersonId?: string
  preferredPersonName?: string
  preferredPersonRole?: string
  decisionRelevance?: DecisionRelevance
  hasDecisionMaker?: boolean
  hasDirectPhone?: boolean
  hasBusinessMobile?: boolean
  hasDirectEmail?: boolean
  peopleCount?: number
  peopleResearchedAt?: string
  fingerprint?: string
  excluded: boolean
  exclusionReason?: string
  saved: boolean
  createdAt: string
  updatedAt: string
}

export interface SearchRun {
  id: string
  params: Record<string, unknown>
  area: string
  industry: string
  provider: string
  startedAt: string
  finishedAt?: string
  found: number
  neu: number
  duplicates: number
  excluded: number
  saved: number
  errors: string[]
  status: 'laufend' | 'fertig' | 'abgebrochen' | 'fehler'
}

export interface SearchParams {
  city?: string
  plz?: string
  region?: string
  radiusKm?: number
  industry: string
  keyword?: string
  maxResults?: number
  onlyWithoutWebsite?: boolean
  onlyWithWebsite?: boolean
  onlyWithPhone?: boolean
  onlyWithEmail?: boolean
  analyzeWebsites?: boolean
}

export interface DuplicateMatch {
  status: DupStatus
  companyId?: string
  score?: number
  reasons: string[]
}

/* ─────────────────────────  Personen- & Entscheider-Recherche  ───────────────────────── */

/** Entscheidungsrelevanz (interner Score, nur aus tatsächlich gefundener Rolle). */
export type DecisionRelevance = 'sehr_hoch' | 'hoch' | 'mittel' | 'unbekannt'
export const DECISION_RELEVANCE_LABELS: Record<DecisionRelevance, string> = {
  sehr_hoch: 'Sehr hohe Entscheidungsrelevanz',
  hoch: 'Hohe Entscheidungsrelevanz',
  mittel: 'Mittlere Entscheidungsrelevanz',
  unbekannt: 'Rolle unklar'
}

/** Vertrauenswürdigkeit einer Personen-/Kontaktinformation (aus der Quellenqualität). */
export type ConfidenceLevel = 'sehr_hoch' | 'hoch' | 'mittel' | 'niedrig'
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  sehr_hoch: 'Offiziell bestätigt',
  hoch: 'Hohe Vertrauenswürdigkeit',
  mittel: 'Mittlere Vertrauenswürdigkeit',
  niedrig: 'Nicht bestätigt'
}

/** Datenschutz-/Kontaktstatus einer Person (geschäftliche Kontaktdaten). */
export type PersonContactStatus =
  | 'zu_pruefen' // geschäftlicher Kontakt erlaubt zu prüfen (Standard)
  | 'nicht_geprueft' // noch nicht rechtlich geprüft
  | 'kein_kontakt' // kein Kontakt gewünscht (Widerspruch)
  | 'nicht_verwenden' // Kontaktdaten nicht mehr verwenden
  | 'daten_pruefen' // Daten müssen geprüft werden
  | 'veraltet' // Daten veraltet
  | 'ausgeschieden' // Person nicht mehr im Unternehmen
export const PERSON_CONTACT_STATUS_LABELS: Record<PersonContactStatus, string> = {
  zu_pruefen: 'Kontakt erlaubt – zu prüfen',
  nicht_geprueft: 'Noch nicht rechtlich geprüft',
  kein_kontakt: 'Kein Kontakt gewünscht',
  nicht_verwenden: 'Kontaktdaten nicht mehr verwenden',
  daten_pruefen: 'Daten müssen geprüft werden',
  veraltet: 'Daten veraltet',
  ausgeschieden: 'Nicht mehr im Unternehmen'
}
/** Status, bei denen die Person nicht mehr als aktive Kontaktoption erscheint. */
export const BLOCKING_PERSON_STATUSES: PersonContactStatus[] = ['kein_kontakt', 'nicht_verwenden', 'ausgeschieden']

/** Typ einer Telefonnummer. */
export type PhoneType =
  | 'zentrale'
  | 'festnetz'
  | 'durchwahl'
  | 'geschaeftlich_mobil'
  | 'allgemein_mobil'
  | 'fax'
  | 'moeglicherweise_privat'
  | 'unbekannt'
export const PHONE_TYPE_LABELS: Record<PhoneType, string> = {
  zentrale: 'Unternehmenszentrale',
  festnetz: 'Festnetz',
  durchwahl: 'Direkte Durchwahl',
  geschaeftlich_mobil: 'Geschäftliche Mobilnummer',
  allgemein_mobil: 'Allgemeine Mobilnummer',
  fax: 'Fax',
  moeglicherweise_privat: 'Möglicherweise privat',
  unbekannt: 'Unbekannt'
}

/** Einschätzung, wie eindeutig eine Mobilnummer geschäftlich ist (nie „privat sicher“ behaupten). */
export type MobileBusinessConfidence = 'geschaeftlich' | 'moeglicherweise' | 'allgemein' | 'privat_nicht_ausgeschlossen'
export const MOBILE_CONFIDENCE_LABELS: Record<MobileBusinessConfidence, string> = {
  geschaeftlich: 'Geschäftliche Mobilnummer',
  moeglicherweise: 'Möglicherweise geschäftlich',
  allgemein: 'Allgemeine Mobilnummer des Unternehmens',
  privat_nicht_ausgeschlossen: 'Private Nutzung nicht ausgeschlossen'
}

export type ContactMethodKind = 'phone' | 'mobile' | 'email' | 'fax' | 'profile'

/** Eine geschäftliche Kontaktmöglichkeit einer Person (oder allgemein des Unternehmens). */
export interface PersonContactMethod {
  id: number
  personId: string
  companyId: string
  kind: ContactMethodKind
  phoneType?: PhoneType
  value: string
  normalizedValue?: string
  isDirect: boolean
  isMobile: boolean
  isBusinessPublished: boolean
  mobileConfidence?: MobileBusinessConfidence
  isPreferred: boolean
  source?: string
  sourceUrl?: string
  verifiedAt?: string
  verificationStatus?: 'unbestaetigt' | 'bestaetigt' | 'veraltet'
  createdAt: string
}

/** Belegte Quelle für eine Personeninformation. */
export interface PersonSource {
  id: number
  personId: string
  source: string
  sourceUrl?: string
  sourceQuality: ConfidenceLevel
  snippet?: string
  foundAt: string
}

/** Eine mit einem Unternehmen verknüpfte Person (Inhaber, Geschäftsführung, Entscheider …). */
export interface CompanyPerson {
  id: string
  companyId: string
  fullName: string
  salutation?: string
  firstName?: string
  lastName?: string
  title?: string // akad. Titel (Dr., Prof. …)
  role?: string // primäre Funktion (Klartext)
  roles?: string[] // alle gefundenen Rollen
  department?: string
  isOwner: boolean
  isFounder: boolean
  isManagingDirector: boolean
  isShareholder: boolean
  isDecisionMaker: boolean
  decisionRelevance: DecisionRelevance
  decisionScore: number
  isPreferredContact: boolean
  confidenceLevel: ConfidenceLevel
  contactStatus: PersonContactStatus
  note?: string
  noteEdited?: boolean
  source?: string
  sourceUrl?: string
  firstSeenAt: string
  lastVerifiedAt?: string
  createdAt: string
  updatedAt: string
  contacts?: PersonContactMethod[]
  sources?: PersonSource[]
}

/** Konflikt zwischen Quellen (z. B. zwei unterschiedliche Geschäftsführer). */
export interface PersonDataConflict {
  id: number
  companyId: string
  personId?: string
  field: string
  valueA: string
  valueB: string
  sourceA?: string
  sourceB?: string
  resolved: boolean
  at: string
}

/** Ergebnis/Protokoll eines Personen-Recherchelaufs. */
export interface PersonResearchRun {
  id: string
  companyId: string
  startedAt: string
  finishedAt?: string
  pagesChecked: string[]
  peopleFound: number
  contactsFound: number
  status: 'laufend' | 'fertig' | 'fehler'
  log: string[]
}
