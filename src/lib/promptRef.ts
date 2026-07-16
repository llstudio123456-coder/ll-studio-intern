import type { CompetitorAnalysis, TargetWebsiteAnalysis, InspirationReference, WebsiteFeatures } from '@shared/types'

const FEATURE_LABELS: Record<keyof WebsiteFeatures, string> = {
  contactForm: 'Kontaktformular',
  onlineBooking: 'Online-Terminbuchung',
  whatsapp: 'WhatsApp',
  phoneClickToCall: 'Klick-zum-Anrufen',
  reviews: 'Bewertungen',
  beforeAfter: 'Vorher/Nachher',
  faq: 'FAQ',
  career: 'Karriere',
  gallery: 'Galerie',
  newsletter: 'Newsletter',
  liveChat: 'Live-Chat',
  multiLanguage: 'Mehrsprachig',
  cookieBanner: 'Cookie-Consent'
}

function featureLabels(f: WebsiteFeatures): string[] {
  return (Object.keys(FEATURE_LABELS) as (keyof WebsiteFeatures)[]).filter((k) => f[k] && k !== 'cookieBanner').map((k) => FEATURE_LABELS[k])
}

export function refFromCompetitor(c: CompetitorAnalysis): InspirationReference {
  return {
    url: c.snapshot.finalUrl,
    companyName: c.snapshot.companyName,
    industry: c.snapshot.industry,
    designStyle: c.snapshot.designStyle,
    colors: c.snapshot.colors.map((x) => x.hex),
    score: c.score.total,
    visualScore: c.score.breakdown.designQuality,
    usefulSections: c.snapshot.pages.map((p) => p.label).slice(0, 10),
    features: featureLabels(c.snapshot.features),
    whyInspiring: c.whyMatches || c.whyInspiring,
    screenshot: c.snapshot.screenshotDesktop,
    fromAnalysis: true
  }
}

export function refFromTarget(t: TargetWebsiteAnalysis): InspirationReference {
  return {
    url: t.finalUrl,
    companyName: t.companyName,
    industry: t.industry,
    designStyle: t.designStyle,
    colors: t.colors.map((x) => x.hex),
    usefulSections: t.pages.map((p) => p.label).slice(0, 10),
    features: featureLabels(t.features),
    whyInspiring: t.strengths[0],
    screenshot: t.screenshotDesktop,
    fromAnalysis: true
  }
}

/** Leere Referenz für manuelle Eingabe (nur URL/Name bekannt). */
export function refFromUrl(url: string, name?: string): InspirationReference {
  return { url, companyName: name, colors: [], usefulSections: [], features: [], fromAnalysis: false }
}
