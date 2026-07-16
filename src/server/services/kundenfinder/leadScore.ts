import type { LeadCandidate, LeadScore, WebsiteAnalysis } from '@shared/kundenfinder'

/**
 * Lead-Score: wie interessant ist das Unternehmen für LL Studio (0..100).
 * Hoher Website-Verbesserungsbedarf + gute Erreichbarkeit = interessanter Lead.
 * Jeder Punkt wird begründet.
 */
export function computeLeadScore(c: Partial<LeadCandidate> & { website?: string }, wa?: WebsiteAnalysis): LeadScore {
  const reasons: string[] = []
  let score = 15

  const hasWebsite = !!(c.website && c.website.trim())
  if (!hasWebsite) {
    score += 32
    reasons.push('Keine eigene Website gefunden – hoher Bedarf.')
  } else if (wa) {
    if (wa.score >= 61) { score += 30; reasons.push(`Website stark verbesserungswürdig (Potenzial ${wa.score}).`) }
    else if (wa.score >= 41) { score += 20; reasons.push(`Deutliches Website-Verbesserungspotenzial (${wa.score}).`) }
    else if (wa.score >= 21) { score += 8; reasons.push(`Kleinere Website-Schwächen (${wa.score}).`) }
    else { reasons.push(`Website bereits solide (Potenzial ${wa.score}) – geringerer Bedarf.`) }
    if (!wa.reachable) { score += 10; reasons.push('Website aktuell nicht erreichbar.') }
    if (!wa.https) { score += 4; reasons.push('Kein HTTPS.') }
  } else {
    reasons.push('Website noch nicht analysiert.')
  }

  if (c.phone && c.phone.trim()) { score += 8; reasons.push('Telefonnummer vorhanden (erreichbar).') }
  else reasons.push('Keine Telefonnummer gefunden.')
  if (c.email && c.email.trim()) { score += 8; reasons.push('E-Mail-Adresse vorhanden.') }
  if (c.contactName && c.contactName.trim()) { score += 6; reasons.push('Ansprechpartner bekannt.') }

  // Branche mit typisch hohem Webdesign-Bedarf (lokal, sichtbar) – kleiner Bonus
  const local = /handwerk|elektr|sanit|heiz|dach|maler|garten|reinig|restaurant|café|cafe|hotel|friseur|kosmetik|werkstatt|fahrschule|makler|praxis|zahn|physio|fitness|anwalt|steuer|pflege/i
  if (c.industry && local.test(c.industry)) { score += 4; reasons.push('Lokale Branche mit typischem Website-Bedarf.') }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const label: LeadScore['label'] =
    score >= 75 ? 'sehr interessant' : score >= 58 ? 'interessant' : score >= 42 ? 'eventuell interessant' : score >= 25 ? 'geringe priorität' : 'nicht geeignet'
  return { score, label, reasons }
}
