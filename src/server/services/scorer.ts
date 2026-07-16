import type { WebsiteSnapshot, WebsiteScore, DesignStyle } from '@shared/types'

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)))

/**
 * Regelbasiertes Scoring 0..100 aus den lokal messbaren Signalen.
 * Funktioniert vollständig ohne KI.
 */
export function scoreWebsite(snap: WebsiteSnapshot, desiredStyle?: string): WebsiteScore {
  const f = snap.features
  const m = snap.metrics
  const notes: string[] = []

  // 1. Design-Qualität (Heuristik: Bildanteil, Farbharmonie, Stil)
  let designQuality = 55
  if (m.largeImageCount && m.largeImageCount >= 2) designQuality += 12
  if (snap.colors.length >= 2 && snap.colors.length <= 5) designQuality += 10
  else if (snap.colors.length > 7) designQuality -= 10
  if (snap.designStyle === 'premium' || snap.designStyle === 'elegant' || snap.designStyle === 'minimalistisch')
    designQuality += 8
  if (snap.designStyle === 'verspielt') designQuality -= 8
  designQuality = clamp(designQuality)

  // 2. Modernität
  let modernity = 50
  if (m.hasViewportMeta) modernity += 15
  if (m.httpsValid) modernity += 10
  if (f.cookieBanner) modernity += 5 // moderne Pflicht-Implementierung
  if ((m.domNodes || 0) > 200) modernity += 8
  modernity = clamp(modernity)

  // 3. Mobile
  let mobile = m.hasViewportMeta ? 75 : 30
  if (snap.screenshotMobile) mobile += 10
  mobile = clamp(mobile)

  // 4. Struktur
  let structure = 40 + Math.min(snap.pages.length, 8) * 6
  if (snap.pages.find((p) => p.type === 'services')) structure += 6
  if (snap.pages.find((p) => p.type === 'contact')) structure += 4
  structure = clamp(structure)

  // 5. Call-to-Actions / Kontakt
  let callToActions = 35
  if (f.contactForm) callToActions += 20
  if (f.phoneClickToCall) callToActions += 15
  if (f.onlineBooking) callToActions += 15
  if (f.whatsapp) callToActions += 10
  callToActions = clamp(callToActions)

  // 6. Bilder
  let imagery = 40
  if (m.imageCount && m.imageCount >= 6) imagery += 20
  if (m.largeImageCount && m.largeImageCount >= 3) imagery += 20
  if (f.gallery) imagery += 10
  imagery = clamp(imagery)

  // 7. Stil-Fit zur Branche/Wunsch
  let styleFit = 60
  if (desiredStyle && snap.designStyle && desiredStyle.toLowerCase().includes(snap.designStyle))
    styleFit += 25
  if (snap.industryConfidence && snap.industryConfidence > 0.5) styleFit += 10
  styleFit = clamp(styleFit)

  // 8. Vertrauenssignale
  let trustSignals = 30
  if (f.reviews) trustSignals += 25
  if (snap.location) trustSignals += 15
  if (snap.pages.find((p) => p.type === 'references')) trustSignals += 12
  if (snap.pages.find((p) => p.type === 'about')) trustSignals += 8
  if (f.career) trustSignals += 5
  trustSignals = clamp(trustSignals)

  // 9. Performance / Technik
  let performance = 70
  if (m.loadMs) {
    if (m.loadMs < 1500) performance = 92
    else if (m.loadMs < 3000) performance = 80
    else if (m.loadMs < 5000) performance = 62
    else performance = 42
  }
  if (!m.httpsValid) performance -= 15
  performance = clamp(performance)

  // 10. Inspirations-Wert
  let inspirationValue = Math.round(
    (designQuality * 0.4 + structure * 0.25 + imagery * 0.2 + trustSignals * 0.15)
  )
  if (snap.wordCount > 600) inspirationValue += 4
  inspirationValue = clamp(inspirationValue)

  const breakdown = {
    designQuality,
    modernity,
    mobile,
    structure,
    callToActions,
    imagery,
    styleFit,
    trustSignals,
    performance,
    inspirationValue
  }

  // Gewichtete Gesamtnote
  const weights: Record<keyof typeof breakdown, number> = {
    designQuality: 0.2,
    modernity: 0.1,
    mobile: 0.1,
    structure: 0.1,
    callToActions: 0.1,
    imagery: 0.1,
    styleFit: 0.08,
    trustSignals: 0.1,
    performance: 0.07,
    inspirationValue: 0.05
  }
  let total = 0
  for (const k of Object.keys(weights) as (keyof typeof breakdown)[]) {
    total += breakdown[k] * weights[k]
  }

  if (!snap.reachable) {
    notes.push('Seite nicht erreichbar – Score nur eingeschränkt aussagekräftig.')
    total = total * 0.3
  }
  if (snap.blocked) notes.push('Seite hat Zugriff/Scraping eingeschränkt – Daten evtl. unvollständig.')
  if (designQuality >= 75) notes.push('Optisch überdurchschnittlich.')
  if (trustSignals >= 70) notes.push('Starke Vertrauenssignale.')

  return { total: clamp(total), breakdown, notes }
}

export function styleLabel(s: DesignStyle): string {
  return s === 'unbekannt' ? 'nicht eindeutig' : s
}
