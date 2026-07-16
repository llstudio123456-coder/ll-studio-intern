import type { Company } from '@shared/kundenfinder'

export type ContactCompleteness = 'vollstaendig' | 'teilweise' | 'keine'
export type PriorityClass = 'A' | 'B' | 'C' | 'D'

const has = (v?: string | null) => !!(v && v.trim())

/** Kontaktvollständigkeit aus Telefon + E-Mail. */
export function contactCompleteness(c: Pick<Company, 'phone' | 'email'>): ContactCompleteness {
  const p = has(c.phone)
  const e = has(c.email)
  if (p && e) return 'vollstaendig'
  if (p || e) return 'teilweise'
  return 'keine'
}

const LOCAL_INDUSTRY = /handwerk|elektr|sanit|heiz|dach|maler|garten|reinig|restaurant|café|cafe|hotel|friseur|kosmetik|werkstatt|fahrschule|makler|praxis|zahn|physio|fitness|anwalt|steuer|pflege|bäck|metzg|tischler|schreiner/i

/**
 * Akquise-Priorität (A–D) + nachvollziehbare Begründung.
 * Gewichtung: Website-Potenzial 50 % · Kontaktvollständigkeit 25 % · Branche 10 % ·
 * Region 5 % · Ansprechpartner 5 % · Datenvollständigkeit 5 %.
 * HARTE REGEL: ohne Telefon UND E-Mail nie Klasse A.
 */
export function acquisitionPriority(c: Company): { klasse: PriorityClass; score: number; reason: string } {
  const potential = c.websiteScore ?? (has(c.website) ? 50 : 92) // hoch = hoher Verbesserungsbedarf
  const cc = contactCompleteness(c)
  const ccPts = cc === 'vollstaendig' ? 25 : cc === 'teilweise' ? 12 : 0
  const industry = c.industry && LOCAL_INDUSTRY.test(c.industry) ? 10 : 4
  const region = 4
  const person = has(c.contactName) ? 5 : 0
  const dataFields = [c.street, c.plz, c.city, c.website, c.phone, c.email, c.industry].filter((x) => has(x as string)).length
  const dataPts = Math.round((dataFields / 7) * 5)
  const score = Math.max(0, Math.min(100, Math.round(potential * 0.5 + ccPts + industry * 0.6 + region * 0.5 + person + dataPts)))

  let klasse: PriorityClass
  if (cc === 'vollstaendig') klasse = potential >= 61 ? 'A' : potential >= 40 ? 'B' : potential >= 20 ? 'C' : 'D'
  else if (cc === 'teilweise') klasse = potential >= 41 ? 'C' : 'D'
  else klasse = 'D'

  // Begründung
  const parts: string[] = []
  if (!has(c.website)) parts.push('keine eigene Website (sehr hohes Potenzial)')
  else if (potential >= 61) parts.push(`stark verbesserungswürdige Website (Potenzial ${potential})`)
  else if (potential >= 40) parts.push(`deutliches Website-Potenzial (${potential})`)
  else parts.push(`Website eher solide (Potenzial ${potential})`)
  if (cc === 'vollstaendig') parts.push('Telefon und E-Mail vorhanden')
  else if (cc === 'teilweise') parts.push(has(c.phone) ? 'E-Mail fehlt' : 'Telefonnummer fehlt')
  else parts.push('keine verwertbaren Kontaktdaten')
  if (has(c.contactName)) parts.push('Ansprechpartner bekannt')
  return { klasse, score, reason: parts.join(', ') + '.' }
}

/**
 * Kurze, sachliche KI-Website-Notiz – NUR aus vorhandenen Analysedaten (keine erfundenen Probleme).
 * Bei unsicherer Datenlage bewusst vorsichtig.
 */
export function buildWebsiteNote(c: Company, issues?: string[]): string {
  const cc = contactCompleteness(c)
  const kontaktSatz = cc === 'vollstaendig' ? 'Telefon und E-Mail sind vorhanden' : cc === 'teilweise' ? (has(c.phone) ? 'eine Telefonnummer ist vorhanden' : 'eine E-Mail-Adresse ist vorhanden') : 'es wurden keine Kontaktdaten gefunden'

  if (!has(c.website)) {
    return `Für ${c.name} wurde keine eigene Website gefunden. ${cc === 'vollstaendig' ? 'Da Telefon und E-Mail vorhanden sind, könnte ein kostenloser Website-Vorschlag besonders interessant sein.' : `Kontaktdaten: ${kontaktSatz}.`}`.slice(0, 320)
  }

  const list = (issues && issues.length ? issues : c.websiteReasons || []).filter(Boolean)
  if (!list.length) {
    return `Die Website von ${c.name} wurde noch nicht ausführlich analysiert. Eine Prüfung kann Verbesserungspotenzial sichtbar machen (${kontaktSatz}).`.slice(0, 320)
  }
  const top = list.slice(0, 2).map((s) => s.replace(/\s*\(Hinweis\)\.?$/i, '').replace(/\.$/, '').toLowerCase())
  const einschub = top.join(' und ')
  const chance =
    /mobil|smartphone|viewport|überlauf/i.test(einschub) ? 'Eine moderne, mobil optimierte Umsetzung könnte die Kontaktaufnahme spürbar vereinfachen.'
    : /kontakt|telefon|cta|handlungsauff/i.test(einschub) ? 'Klar sichtbare Kontaktmöglichkeiten könnten mehr Anfragen bringen.'
    : /copyright|veraltet|inhalt|struktur/i.test(einschub) ? 'Eine zeitgemäße Struktur und aktuellere Inhalte würden professioneller wirken.'
    : 'Eine hochwertigere Umsetzung könnte den Gesamteindruck deutlich verbessern.'
  return `Die Website weist ${einschub} auf. ${chance}`.slice(0, 320)
}

/** true, wenn das Unternehmen die qualifizierte Hauptliste erreicht (vollständige Kontaktdaten). */
export function isQualified(c: Pick<Company, 'phone' | 'email'>): boolean {
  return contactCompleteness(c) === 'vollstaendig'
}
