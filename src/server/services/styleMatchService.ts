import type { InspirationReference, StyleProfile, StyleMatch, PreviewPalette } from '@shared/types'

function hexLum(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
function refDarkness(colors: string[]): number | null {
  const l = colors.map(hexLum).filter((x): x is number => x != null)
  if (!l.length) return null
  return 1 - l.reduce((a, b) => a + b, 0) / l.length
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

const SERIF_ARCHETYPES = ['dark-cinematic-restaurant', 'light-premium-restaurant', 'luxury-service']

/**
 * Bewertet, wie stark die generierte Vorschau die Referenz-Wirkung trifft (0..100).
 */
export function computeStyleMatch(profile: StyleProfile, _palette: PreviewPalette, insp: InspirationReference): StyleMatch {
  const notes: string[] = []

  // Farb-Stimmung (dunkel/hell)
  const refDark = refDarkness(insp.colors)
  const conceptDark = profile.backgroundStyle === 'dark' ? 0.85 : profile.backgroundStyle === 'cream' ? 0.2 : 0.1
  let colorMood: number
  if (refDark == null) colorMood = 72
  else {
    colorMood = clamp(100 - Math.abs(refDark - conceptDark) * 130)
    if (refDark >= 0.5 && profile.backgroundStyle !== 'dark') notes.push('Referenz wirkt dunkler – evtl. „Dunkler“ wählen.')
    if (refDark < 0.35 && profile.backgroundStyle === 'dark') notes.push('Referenz wirkt heller – evtl. „Heller“ wählen.')
  }

  // Archetyp
  let archetype = profile.archetype === 'generic' ? 45 : 92
  if (profile.archetype === 'generic') notes.push('Kein klarer Archetyp erkannt – Stil manuell wählen.')

  // Typografie
  const expectSerif = SERIF_ARCHETYPES.includes(profile.archetype)
  const typography = expectSerif === (profile.typographyMood === 'serif-display') ? 95 : 62
  if (typography < 80) notes.push('Typografie-Gefühl weicht ab.')

  // Hero-Komposition
  const heroComposition = profile.heroType === 'cinematic-full' ? 95 : profile.heroType === 'split-image' ? 90 : profile.heroType === 'centered' ? 80 : 58

  // CTA
  const restaurant = profile.archetype.includes('restaurant')
  const cta = restaurant ? 95 : 82

  // Navigation
  const navigation = profile.navPosition === 'over-hero' ? 94 : 82

  // Bildnutzung
  const refImageHeavy = (insp.features || []).some((f) => /galerie|gallery|bild|foto|vorher/i.test(f)) || restaurant
  let imageUsage = profile.imageHeavy ? 92 : 70
  if (refImageHeavy && !profile.imageHeavy) {
    imageUsage = 60
    notes.push('Referenz ist bildstärker – evtl. „Mehr Bilder“ wählen.')
  }

  // Branchen-Stimmung
  const industryMood = profile.archetype === 'generic' || profile.archetype === 'modern-local-business' ? 74 : 90

  const breakdown = { colorMood, archetype, typography, heroComposition, cta, navigation, imageUsage, industryMood }
  const weights: Record<keyof typeof breakdown, number> = {
    colorMood: 0.2,
    archetype: 0.2,
    typography: 0.12,
    heroComposition: 0.14,
    cta: 0.1,
    navigation: 0.08,
    imageUsage: 0.1,
    industryMood: 0.06
  }
  let score = 0
  for (const k of Object.keys(weights) as (keyof typeof breakdown)[]) score += breakdown[k] * weights[k]

  return { score: clamp(score), breakdown, notes }
}
