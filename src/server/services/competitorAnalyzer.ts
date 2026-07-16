import type {
  CompetitorCandidate,
  CompetitorAnalysis,
  WebsiteSnapshot,
  TargetWebsiteAnalysis,
  RunConfig
} from '@shared/types'
import { BrowserManager } from './browser'
import { analyzeWebsite } from './extract'
import { scoreWebsite } from './scorer'

const DISCLAIMER =
  'Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren.'

/** Baut die textlichen Bewertungen (regelbasiert, ohne KI). */
function buildNarrative(snap: WebsiteSnapshot, target: TargetWebsiteAnalysis) {
  const f = snap.features
  const strong: string[] = []
  if (f.gallery) strong.push('Galerie/Referenzen zeigt Arbeitsergebnisse')
  if (f.reviews) strong.push('Sichtbare Bewertungen schaffen Vertrauen')
  if (f.onlineBooking) strong.push('Online-Terminbuchung senkt die Hürde')
  if (f.contactForm) strong.push('Klares Kontaktformular')
  if (f.beforeAfter) strong.push('Vorher-Nachher-Bilder als Beweis')
  if (snap.metrics.largeImageCount && snap.metrics.largeImageCount >= 3)
    strong.push('Großflächige, hochwertige Bildsprache')
  if (snap.pages.find((p) => p.type === 'services')) strong.push('Eigene, strukturierte Leistungsseiten')
  if (snap.designStyle === 'premium' || snap.designStyle === 'elegant')
    strong.push(`Hochwertiger ${snap.designStyle}er Designstil`)
  if (strong.length === 0) strong.push('Solide Basisstruktur')

  const ideas: string[] = []
  if (f.onlineBooking && !target.features.onlineBooking) ideas.push('Online-Terminbuchung einbauen')
  if (f.reviews && !target.features.reviews) ideas.push('Google-Bewertungen/Sterne sichtbar einbinden')
  if (f.beforeAfter && !target.features.beforeAfter) ideas.push('Vorher-Nachher-Slider ergänzen')
  if (f.gallery && !target.features.gallery) ideas.push('Referenz-/Projektgalerie aufbauen')
  if (snap.pages.find((p) => p.type === 'services') && target.pages.filter((p) => p.type === 'services').length === 0)
    ideas.push('Eigene Leistungsseiten je Angebot anlegen')
  if (snap.metrics.largeImageCount && (target.metrics.largeImageCount || 0) < 2)
    ideas.push('Stärkere, großformatige Bildsprache nutzen')
  if (ideas.length === 0) ideas.push('Klarere visuelle Hierarchie & mehr Weißraum übernehmen')

  const colors = snap.colors.slice(0, 3).map((c) => c.hex).join(', ')
  const shortDescription = `${snap.companyName || snap.domain} – ${snap.industry || 'Branche unklar'}${
    snap.location ? `, ${snap.location}` : ''
  }. Stil: ${snap.designStyle}. Hauptfarben: ${colors || 'n/a'}.`

  const whyInspiring =
    `Gute Orientierung für ${target.industry || 'die Zielbranche'}: ` +
    `${strong.slice(0, 3).join('; ')}.`

  return {
    shortDescription,
    whyInspiring,
    strongElements: strong.slice(0, 6),
    ideasToAdopt: ideas.slice(0, 6),
    doNotCopyWarning:
      'Übernimm nur Struktur- und Designprinzipien. Texte, Fotos, Logo, Farbverläufe und Wortlaut sind urheberrechtlich geschützt – nicht 1:1 kopieren.'
  }
}

let idc = 0

/** Analysiert einen einzelnen Kandidaten und bewertet ihn. */
export async function analyzeCandidate(
  bm: BrowserManager,
  cand: CompetitorCandidate,
  target: TargetWebsiteAnalysis,
  config: RunConfig
): Promise<CompetitorAnalysis> {
  const snap = await analyzeWebsite(bm, cand.url, {
    styleHint: config.style,
    light: false,
    takeScreenshots: true
  })
  const score = scoreWebsite(snap, config.style)
  const narrative = buildNarrative(snap, target)

  return {
    id: `c${++idc}_${snap.domain}`,
    snapshot: snap,
    score,
    ...narrative,
    source: cand.source,
    foundVia: cand.foundVia,
    doNotCopyWarning: narrative.doNotCopyWarning || DISCLAIMER
  }
}

export const COMPETITOR_DISCLAIMER = DISCLAIMER
