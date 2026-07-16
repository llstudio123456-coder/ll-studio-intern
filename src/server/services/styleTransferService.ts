import type {
  InspirationReference,
  StyleProfile,
  StyleControls,
  StyleArchetype,
  PreviewSectionType
} from '@shared/types'
import { buildStyleProfile } from './styleFingerprintService'

/* ── Farb-/Helligkeits-Hilfen ── */
function hexLum(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Durchschnittliche Dunkelheit der Referenzfarben (0 hell … 1 dunkel). */
function darknessFromColors(colors: string[]): number {
  const lums = colors.map(hexLum).filter((x): x is number => x != null)
  if (!lums.length) return 0.4
  const avg = lums.reduce((a, b) => a + b, 0) / lums.length
  return Number((1 - avg).toFixed(2))
}

const RESTAURANT = /restaurant|gastro|café|cafe|bistro|pizzeria|trattoria|küche|kitchen|food|bar|brasserie/i
const MEDICAL = /zahnarzt|arzt|ärzt|praxis|medizin|dental|klinik|therapie|physio/i
const AUTO = /autohaus|kfz|fahrzeug|automobile|car|werkstatt/i
const CRAFT = /handwerk|maler|dach|elektr|sanitär|heizung|garten|galabau|bau|tischler|schreiner|zimmer|fenster/i
const AGENCY = /agentur|agency|studio|design|marketing|kreativ|web/i
const LUXURY_IND = /hotel|immobilien|anwalt|kanzlei|steuer|juwelier|beauty|spa|wellness/i

/** Erkennt den visuellen Archetyp aus Referenz + Reglern. */
export function detectArchetype(insp: InspirationReference, controls?: StyleControls): StyleArchetype {
  if (controls?.archetypeOverride) return controls.archetypeOverride

  const text = `${insp.industry || ''} ${insp.companyName || ''} ${insp.url || ''} ${(insp.usefulSections || []).join(' ')}`
  const style = (insp.designStyle || '').toLowerCase()
  const darkness = darknessFromColors(insp.colors)
  const wantsDark = darkness >= 0.5 || /dunkel|dark|premium|elegant|luxuriös|cinematic/.test(style) || controls?.darknessOverride === 'darker'

  if (RESTAURANT.test(text)) return wantsDark ? 'dark-cinematic-restaurant' : 'light-premium-restaurant'
  if (MEDICAL.test(text)) return 'medical-clean'
  if (AUTO.test(text)) return 'automotive-premium'
  if (CRAFT.test(text)) return 'craftsman-trust'
  if (AGENCY.test(text)) return 'minimalist-agency'
  if (LUXURY_IND.test(text) || /premium|luxuriös|luxury|elegant/.test(style)) return 'luxury-service'
  return 'modern-local-business'
}

interface ArchetypeBase {
  layoutType: string
  heroType: StyleProfile['heroType']
  backgroundStyle: StyleProfile['backgroundStyle']
  overlay: boolean
  navPosition: StyleProfile['navPosition']
  sectionOrder: PreviewSectionType[]
  visualMood: string
  emotionalMood: string
  spacingStyle: StyleProfile['spacingStyle']
  cornerRadius: StyleProfile['cornerRadius']
  cardStyle: string
  navigationStyle: string
  ctaStyle: string
  typographyMood: StyleProfile['typographyMood']
  fontCategory: StyleProfile['fontCategory']
  imageHeavy: boolean
  hasSlider: boolean
  imageTreatment: string
  premiumSignals: string[]
}

const ARCHETYPES: Record<StyleArchetype, ArchetypeBase> = {
  'dark-cinematic-restaurant': {
    layoutType: 'kinoreifer Vollbild-Hero, dunkel, großflächige Food-Bilder',
    heroType: 'cinematic-full',
    backgroundStyle: 'dark',
    overlay: true,
    navPosition: 'over-hero',
    sectionOrder: ['header', 'hero', 'trust', 'menu', 'gallery', 'about', 'reviews', 'contact', 'footer'],
    visualMood: 'dunkel, elegant, cinematic',
    emotionalMood: 'edel, atmosphärisch, sinnlich',
    spacingStyle: 'großzügig',
    cornerRadius: 'scharf',
    cardStyle: 'dunkle, randlose Flächen mit feinem Goldakzent',
    navigationStyle: 'minimalistische Navigation über dem Hero, Logo prominent/zentriert',
    ctaStyle: 'eleganter Reservierungs-CTA (Tisch reservieren), unten fixierte Buchungsleiste',
    typographyMood: 'serif-display',
    fontCategory: 'serif',
    imageHeavy: true,
    hasSlider: true,
    imageTreatment: 'großformatige, stimmungsvolle Food-Bilder mit dunklem Overlay',
    premiumSignals: ['dunkles Overlay', 'große Serif-Headline', 'Letter-Spacing-Eyebrow', 'Goldakzent', 'Vollbild-Bildsprache']
  },
  'light-premium-restaurant': {
    layoutType: 'hell, premium, große Food-Bilder, viel Weißraum',
    heroType: 'split-image',
    backgroundStyle: 'cream',
    overlay: false,
    navPosition: 'top-bar',
    sectionOrder: ['header', 'hero', 'trust', 'menu', 'gallery', 'about', 'reviews', 'contact', 'footer'],
    visualMood: 'hell, edel, appetitlich',
    emotionalMood: 'einladend, frisch, hochwertig',
    spacingStyle: 'großzügig',
    cornerRadius: 'soft',
    cardStyle: 'helle Cards mit weichen Ecken und ruhigem Schatten',
    navigationStyle: 'klare Top-Navigation, Logo links, Reservierungs-CTA rechts',
    ctaStyle: 'klarer Reservierungs-CTA',
    typographyMood: 'serif-display',
    fontCategory: 'mixed',
    imageHeavy: true,
    hasSlider: false,
    imageTreatment: 'helle, frische Food-Fotografie',
    premiumSignals: ['Serif-Headline', 'große Bildflächen', 'viel Weißraum', 'warme Akzentfarbe']
  },
  'luxury-service': {
    layoutType: 'edel, ruhig, viel Weißraum, große Serif-Headlines',
    heroType: 'centered',
    backgroundStyle: 'light',
    overlay: false,
    navPosition: 'top-bar',
    sectionOrder: ['header', 'hero', 'trust', 'services', 'about', 'benefits', 'reviews', 'contact', 'footer'],
    visualMood: 'edel, ruhig, hochwertig',
    emotionalMood: 'vertrauenswürdig, exklusiv',
    spacingStyle: 'großzügig',
    cornerRadius: 'soft',
    cardStyle: 'sehr ruhige Cards, feine Linien',
    navigationStyle: 'reduzierte Navigation, dezenter CTA',
    ctaStyle: 'dezente, elegante CTAs',
    typographyMood: 'serif-display',
    fontCategory: 'serif',
    imageHeavy: false,
    hasSlider: false,
    imageTreatment: 'ruhige, hochwertige Bilder',
    premiumSignals: ['Serif-Akzente', 'viel Weißraum', 'edle Akzentfarbe', 'feine Linien']
  },
  'minimalist-agency': {
    layoutType: 'minimalistisch, klar, viel Negativraum, große Typo',
    heroType: 'centered',
    backgroundStyle: 'light',
    overlay: false,
    navPosition: 'top-bar',
    sectionOrder: ['header', 'hero', 'services', 'about', 'gallery', 'contact', 'footer'],
    visualMood: 'aufgeräumt, fokussiert, modern',
    emotionalMood: 'klar, selbstbewusst',
    spacingStyle: 'großzügig',
    cornerRadius: 'scharf',
    cardStyle: 'flache Cards, klare Kanten',
    navigationStyle: 'minimalistische Navigation',
    ctaStyle: 'klarer, reduzierter CTA',
    typographyMood: 'modern-sans',
    fontCategory: 'sans',
    imageHeavy: false,
    hasSlider: false,
    imageTreatment: 'wenige, gezielte Bilder',
    premiumSignals: ['maximaler Weißraum', 'reduzierte Palette', 'große Typo']
  },
  'automotive-premium': {
    layoutType: 'kraftvoll, dunkel-metallisch, große Fahrzeugbilder',
    heroType: 'cinematic-full',
    backgroundStyle: 'dark',
    overlay: true,
    navPosition: 'over-hero',
    sectionOrder: ['header', 'hero', 'trust', 'services', 'gallery', 'about', 'contact', 'footer'],
    visualMood: 'kraftvoll, premium, technisch',
    emotionalMood: 'dynamisch, hochwertig',
    spacingStyle: 'ausgewogen',
    cornerRadius: 'soft',
    cardStyle: 'dunkle Cards mit klaren Kanten',
    navigationStyle: 'Navigation über dem Hero',
    ctaStyle: 'starker CTA (Probefahrt/Anfrage)',
    typographyMood: 'modern-sans',
    fontCategory: 'sans',
    imageHeavy: true,
    hasSlider: true,
    imageTreatment: 'große Fahrzeugbilder mit dunklem Overlay',
    premiumSignals: ['dunkles Overlay', 'große Bildsprache', 'kräftige Akzente']
  },
  'craftsman-trust': {
    layoutType: 'bodenständig, klar, echte Projektbilder, direkter Kontakt',
    heroType: 'split-image',
    backgroundStyle: 'light',
    overlay: false,
    navPosition: 'top-bar',
    sectionOrder: ['header', 'hero', 'trust', 'services', 'gallery', 'about', 'reviews', 'contact', 'footer'],
    visualMood: 'vertrauenswürdig, regional, handfest',
    emotionalMood: 'verlässlich, nahbar',
    spacingStyle: 'ausgewogen',
    cornerRadius: 'rund',
    cardStyle: 'kräftige Cards mit klaren Bildern',
    navigationStyle: 'klare Navigation mit prominentem Anruf-CTA',
    ctaStyle: 'prominente Kontakt-/Anruf-Buttons',
    typographyMood: 'modern-sans',
    fontCategory: 'sans',
    imageHeavy: true,
    hasSlider: false,
    imageTreatment: 'echte Projekt-/Arbeitsbilder',
    premiumSignals: ['echte Bilder', 'klare CTAs', 'kräftige Typo']
  },
  'medical-clean': {
    layoutType: 'clean, hell, ruhig, vertrauensbildend',
    heroType: 'split-image',
    backgroundStyle: 'light',
    overlay: false,
    navPosition: 'top-bar',
    sectionOrder: ['header', 'hero', 'trust', 'services', 'about', 'benefits', 'contact', 'footer'],
    visualMood: 'clean, ruhig, vertrauensbildend',
    emotionalMood: 'beruhigend, professionell',
    spacingStyle: 'großzügig',
    cornerRadius: 'soft',
    cardStyle: 'helle, freundliche Cards',
    navigationStyle: 'klare Navigation mit Termin-CTA',
    ctaStyle: 'Termin-CTA',
    typographyMood: 'modern-sans',
    fontCategory: 'sans',
    imageHeavy: false,
    hasSlider: false,
    imageTreatment: 'ruhige, freundliche Bilder',
    premiumSignals: ['viel Weißraum', 'ruhige Farben', 'klare Struktur']
  },
  'modern-local-business': {
    layoutType: 'modern, klar, einladend, ausgewogene Bildsprache',
    heroType: 'split-image',
    backgroundStyle: 'light',
    overlay: false,
    navPosition: 'top-bar',
    sectionOrder: ['header', 'hero', 'trust', 'services', 'about', 'benefits', 'gallery', 'contact', 'footer'],
    visualMood: 'modern, professionell, einladend',
    emotionalMood: 'sympathisch, klar',
    spacingStyle: 'großzügig',
    cornerRadius: 'soft',
    cardStyle: 'weiche Cards mit dezentem Schatten',
    navigationStyle: 'klare horizontale Navigation mit CTA',
    ctaStyle: 'klare CTAs',
    typographyMood: 'modern-sans',
    fontCategory: 'sans',
    imageHeavy: false,
    hasSlider: false,
    imageTreatment: 'hochwertige, konsistente Bilder',
    premiumSignals: ['viel Weißraum', 'klare Typo-Hierarchie', 'wenige Akzentfarben']
  },
  generic: {
    layoutType: 'klares, modernes Standardlayout',
    heroType: 'standard',
    backgroundStyle: 'light',
    overlay: false,
    navPosition: 'top-bar',
    sectionOrder: ['header', 'hero', 'services', 'about', 'contact', 'footer'],
    visualMood: 'modern, neutral',
    emotionalMood: 'neutral',
    spacingStyle: 'ausgewogen',
    cornerRadius: 'soft',
    cardStyle: 'neutrale Cards',
    navigationStyle: 'Standard-Navigation',
    ctaStyle: 'Standard-CTA',
    typographyMood: 'modern-sans',
    fontCategory: 'sans',
    imageHeavy: false,
    hasSlider: false,
    imageTreatment: 'neutrale Bilder',
    premiumSignals: ['klare Struktur']
  }
}

/**
 * Erstellt das vollständige Stilprofil.
 * Delegiert an das Fingerprint-/Template-System, damit UNTERSCHIEDLICHE Referenzen
 * sichtbar unterschiedliche Layouts erzeugen (kein Default-Template mehr).
 */
export function deriveStyleProfile(insp: InspirationReference, controls?: StyleControls): StyleProfile {
  return buildStyleProfile(insp, controls).profile
}

export const ARCHETYPE_LABELS: Record<StyleArchetype, string> = {
  'dark-cinematic-restaurant': 'Dunkel-cinematisch (Restaurant)',
  'light-premium-restaurant': 'Hell-premium (Restaurant)',
  'minimalist-agency': 'Minimalistisch (Agentur)',
  'luxury-service': 'Luxuriös (Dienstleistung)',
  'modern-local-business': 'Modern (lokales Unternehmen)',
  'craftsman-trust': 'Handwerk (Vertrauen)',
  'medical-clean': 'Clean (Medizin)',
  'automotive-premium': 'Premium (Automobil)',
  generic: 'Generisch (Fallback)'
}
