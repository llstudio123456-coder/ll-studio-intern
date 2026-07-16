import type { TargetWebsiteAnalysis, RunConfig } from '@shared/types'
import { BrowserManager } from './browser'
import { analyzeWebsite } from './extract'

/** Erkennt Schwächen der Zielseite (regelbasiert). */
function findWeaknesses(snap: TargetWebsiteAnalysis): string[] {
  const w: string[] = []
  const f = snap.features
  const m = snap.metrics

  if (!m.hasViewportMeta) w.push('Keine Viewport-Angabe → vermutlich schlechte mobile Darstellung.')
  if (!m.httpsValid) w.push('Kein gültiges HTTPS → Vertrauens- und SEO-Nachteil.')
  if (snap.wordCount < 250) w.push('Sehr wenig Inhalt/Text – wirkt dünn und ist schlecht für SEO.')
  if (!f.contactForm && !f.phoneClickToCall) w.push('Keine klar erkennbare Kontaktmöglichkeit / kein Call-to-Action.')
  if (!f.phoneClickToCall) w.push('Telefonnummer nicht als Klick-zum-Anrufen (tel:) hinterlegt.')
  if (!snap.location) w.push('Standort/Adresse nicht eindeutig erkennbar (lokales Vertrauen fehlt).')
  if (!f.reviews) w.push('Keine sichtbaren Bewertungen/Vertrauenssignale (Rezensionen, Sterne).')
  if (snap.metrics.imageCount !== undefined && snap.metrics.imageCount < 4)
    w.push('Wenige Bilder – wenig visueller Eindruck der Leistungen.')
  if (snap.pages.length < 4) w.push('Sehr flache Seitenstruktur – wichtige Unterseiten fehlen evtl.')
  if (!f.gallery) w.push('Keine Galerie/Referenzen – Arbeitsergebnisse werden nicht gezeigt.')
  if (m.loadMs && m.loadMs > 6000) w.push(`Lange Ladezeit (~${Math.round(m.loadMs / 1000)}s) – Nutzer springen ab.`)
  if (snap.colors.length > 7) w.push('Sehr viele Farben – Design wirkt evtl. unruhig/uneinheitlich.')
  if (!snap.metaDescription) w.push('Keine Meta-Description – schwächt Suchmaschinen-Snippet.')
  if (snap.designStyle === 'verspielt') w.push('Design wirkt eher verspielt – evtl. nicht hochwertig/seriös genug.')
  return w
}

function findStrengths(snap: TargetWebsiteAnalysis): string[] {
  const s: string[] = []
  const f = snap.features
  if (snap.metrics.httpsValid) s.push('Sichere HTTPS-Verbindung.')
  if (snap.metrics.hasViewportMeta) s.push('Responsive vorbereitet (Viewport gesetzt).')
  if (f.contactForm) s.push('Kontaktformular vorhanden.')
  if (f.phoneClickToCall) s.push('Klick-zum-Anrufen aktiv.')
  if (f.onlineBooking) s.push('Online-Terminbuchung vorhanden.')
  if (f.reviews) s.push('Bewertungen/Vertrauenssignale sichtbar.')
  if (f.gallery) s.push('Galerie/Referenzen vorhanden.')
  if (snap.wordCount >= 600) s.push('Ausreichend Inhalt für SEO & Vertrauen.')
  if (snap.location) s.push('Standort klar erkennbar (lokale Auffindbarkeit).')
  if (snap.pages.length >= 5) s.push('Saubere, umfangreiche Seitenstruktur.')
  return s
}

export async function analyzeTarget(
  bm: BrowserManager,
  config: RunConfig
): Promise<TargetWebsiteAnalysis> {
  const snap = await analyzeWebsite(bm, config.url, {
    styleHint: config.style,
    industryOverride: config.industryOverride,
    takeScreenshots: true
  })

  const target: TargetWebsiteAnalysis = {
    ...snap,
    weaknesses: [],
    strengths: [],
    resolvedLocation:
      config.region || config.country || snap.location || undefined
  }
  target.weaknesses = findWeaknesses(target)
  target.strengths = findStrengths(target)
  return target
}
