import type {
  InspirationReport,
  TargetWebsiteAnalysis,
  CompetitorAnalysis,
  RunConfig
} from '@shared/types'
import { aiComplete, isAiConfigured } from './ai'
import { log } from '../utils/logger'

const DISCLAIMER =
  'Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren.'

/** Häufigste Features über alle (guten) Mitbewerber finden. */
function commonFeatures(comps: CompetitorAnalysis[]): string[] {
  const keys: [keyof CompetitorAnalysis['snapshot']['features'], string][] = [
    ['onlineBooking', 'Online-Terminbuchung'],
    ['contactForm', 'Kontaktformular'],
    ['whatsapp', 'WhatsApp-Kontakt'],
    ['reviews', 'Sichtbare Bewertungen'],
    ['gallery', 'Referenz-/Projektgalerie'],
    ['beforeAfter', 'Vorher-Nachher-Bereich'],
    ['faq', 'FAQ-Bereich'],
    ['career', 'Karriere-/Jobseite'],
    ['phoneClickToCall', 'Klick-zum-Anrufen']
  ]
  const out: string[] = []
  for (const [k, label] of keys) {
    const share = comps.filter((c) => c.snapshot.features[k]).length / Math.max(comps.length, 1)
    if (share >= 0.4) out.push(`${label} (bei ${Math.round(share * 100)}% der Vorbilder)`)
  }
  return out
}

function topPages(comps: CompetitorAnalysis[]): string[] {
  const count = new Map<string, number>()
  for (const c of comps) {
    const types = new Set(c.snapshot.pages.map((p) => p.type))
    for (const t of types) count.set(t, (count.get(t) || 0) + 1)
  }
  const labels: Record<string, string> = {
    home: 'Startseite',
    services: 'Leistungen (einzeln)',
    about: 'Über uns',
    contact: 'Kontakt',
    gallery: 'Galerie / Referenzen',
    references: 'Kundenstimmen',
    team: 'Team',
    career: 'Karriere',
    blog: 'Blog / Ratgeber',
    pricing: 'Preise / Pakete'
  }
  return Array.from(count.entries())
    .filter(([t]) => labels[t])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([t]) => labels[t])
}

/** Regelbasierter Report (Grundlage, funktioniert ohne KI). */
function ruleBasedReport(
  target: TargetWebsiteAnalysis,
  comps: CompetitorAnalysis[],
  config: RunConfig
): InspirationReport {
  const ranked = [...comps].sort((a, b) => b.score.total - a.score.total)
  const styleCount = new Map<string, number>()
  for (const c of ranked) styleCount.set(c.snapshot.designStyle, (styleCount.get(c.snapshot.designStyle) || 0) + 1)
  const dominantStyle =
    Array.from(styleCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || config.style || 'modern'

  const bestDesign = ranked
    .filter((c) => c.score.breakdown.designQuality >= 65)
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      domain: c.snapshot.domain,
      reason: `Designqualität ${c.score.breakdown.designQuality}/100, Stil „${c.snapshot.designStyle}“`
    }))

  const bestTrust = [...ranked]
    .sort((a, b) => b.score.breakdown.trustSignals - a.score.breakdown.trustSignals)
    .slice(0, 2)
    .map((c) => ({
      id: c.id,
      domain: c.snapshot.domain,
      reason: `Starke Inhalte/Vertrauen (${c.score.breakdown.trustSignals}/100): ${c.strongElements[0] || ''}`
    }))

  const mistakes: string[] = [...target.weaknesses]
  // Vergleich: was haben die Top-Vorbilder, das der Zielseite fehlt?
  const top = ranked.slice(0, Math.min(5, ranked.length))
  if (top.some((c) => c.snapshot.features.reviews) && !target.features.reviews)
    mistakes.push('Bessere Mitbewerber zeigen Bewertungen – die Zielseite nicht.')
  if (top.some((c) => c.snapshot.features.onlineBooking) && !target.features.onlineBooking)
    mistakes.push('Mehrere Vorbilder bieten Online-Terminbuchung – fehlt bei der Zielseite.')
  if (top.some((c) => (c.snapshot.metrics.largeImageCount || 0) >= 3) && (target.metrics.largeImageCount || 0) < 2)
    mistakes.push('Vorbilder setzen auf großformatige Bildsprache – Zielseite wirkt bildarm.')

  return {
    generatedAt: new Date().toISOString(),
    aiUsed: false,
    recommendedDesignDirection: `Empfohlen: „${dominantStyle}“ Richtung – passend zur Branche „${
      target.industry || 'n/a'
    }“ und gut umsetzbar für ${target.companyName || 'den Kunden'}. Ruhiges Layout, klare Typografie, viel Weißraum.`,
    mustHavePages: topPages(ranked).length ? topPages(ranked) : ['Startseite', 'Leistungen', 'Über uns', 'Kontakt'],
    homepageContent: [
      'Klare Hero-Aussage: Was, für wen, in welcher Region',
      'Leistungen im Überblick (3–6 Kacheln)',
      'Referenzen/Projekte mit echten Bildern',
      'Vertrauensblock: Bewertungen, Auszeichnungen, Jahre Erfahrung',
      'Deutlicher Kontakt-CTA (Anruf / Termin / Formular)'
    ],
    recommendedCtas: [
      'Jetzt unverbindlich anfragen',
      target.features.onlineBooking || comps.some((c) => c.snapshot.features.onlineBooking)
        ? 'Termin online buchen'
        : 'Rückruf vereinbaren',
      'Direkt anrufen (Klick-zum-Anrufen)'
    ],
    colorAndLayoutIdeas: [
      `Branchen-passende Farbwelt (Vorbilder nutzen u.a.: ${ranked
        .flatMap((c) => c.snapshot.colors.slice(0, 1).map((x) => x.hex))
        .slice(0, 4)
        .join(', ') || 'neutrale Töne'})`,
      'Großzügige Abstände, klare Sektionen, max. 2–3 Akzentfarben',
      'Konsistente Bildsprache statt Stockfoto-Mix'
    ],
    recommendedFeatures: commonFeatures(comps).length
      ? commonFeatures(comps)
      : ['Kontaktformular', 'Klick-zum-Anrufen', 'Referenzgalerie'],
    bestDesignReferences: bestDesign,
    bestForContentOrTrust: bestTrust,
    targetMistakesVsCompetitors: Array.from(new Set(mistakes)).slice(0, 8),
    disclaimer: DISCLAIMER
  }
}

/** Optional: Report-Prosa per KI verfeinern. Fällt bei Fehler auf Regelbasis zurück. */
async function enrichWithAi(
  report: InspirationReport,
  target: TargetWebsiteAnalysis,
  comps: CompetitorAnalysis[]
): Promise<InspirationReport> {
  const system =
    'Du bist Senior-Webdesign-Stratege einer Premium-Agentur (LL Studio). ' +
    'Antworte knapp, konkret, auf Deutsch. Gib ausschließlich gültiges JSON zurück.'
  const compact = comps.slice(0, 8).map((c) => ({
    domain: c.snapshot.domain,
    score: c.score.total,
    style: c.snapshot.designStyle,
    strong: c.strongElements.slice(0, 3)
  }))
  const user = `Kunden-Webseite:\n${JSON.stringify({
    company: target.companyName,
    industry: target.industry,
    style: target.designStyle,
    weaknesses: target.weaknesses.slice(0, 6)
  })}\n\nMitbewerber-Vorbilder:\n${JSON.stringify(compact)}\n\n` +
    'Gib JSON zurück mit Schlüsseln: recommendedDesignDirection (string), ' +
    'targetMistakesVsCompetitors (string[]), homepageContent (string[]). ' +
    'Knapp und umsetzbar.'

  const raw = await aiComplete(system, user, 900)
  if (!raw) return report
  try {
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return {
      ...report,
      aiUsed: true,
      recommendedDesignDirection: json.recommendedDesignDirection || report.recommendedDesignDirection,
      targetMistakesVsCompetitors: Array.isArray(json.targetMistakesVsCompetitors)
        ? json.targetMistakesVsCompetitors
        : report.targetMistakesVsCompetitors,
      homepageContent: Array.isArray(json.homepageContent) ? json.homepageContent : report.homepageContent
    }
  } catch (e) {
    log.warn('KI-Report nicht parsebar, nutze Regelbasis:', e)
    return report
  }
}

export async function buildInspirationReport(
  target: TargetWebsiteAnalysis,
  comps: CompetitorAnalysis[],
  config: RunConfig
): Promise<InspirationReport> {
  const base = ruleBasedReport(target, comps, config)
  if (isAiConfigured()) return enrichWithAi(base, target, comps)
  return base
}
