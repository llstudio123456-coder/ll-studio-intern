import type { InspirationReference, StyleControls, StyleProfile, StyleFingerprint, PreviewSectionType, StyleArchetype } from '@shared/types'
import { parseHex, lum, sat, hue } from './colorUtils'
import { familyOf } from './industryGate'

/* ── Fingerprint aus Referenz B ── */
export function computeFingerprint(insp: InspirationReference): StyleFingerprint {
  const cols = insp.colors.map(parseHex).filter((c): c is NonNullable<ReturnType<typeof parseHex>> => !!c)
  const darkness = cols.length ? Number((1 - cols.reduce((a, c) => a + lum(c), 0) / cols.length).toFixed(2)) : 0.4
  const saturation = cols.length ? Number((cols.reduce((a, c) => a + sat(c), 0) / cols.length).toFixed(2)) : 0.3
  // Warmth nur aus CHROMATISCHEN Farben (Weiß/Schwarz/Grau haben hue 0 → würden sonst „warm“ zählen)
  const chroma = cols.filter((c) => sat(c) > 0.15)
  const warmth = chroma.length ? Number((chroma.filter((c) => { const h = hue(c); return h <= 55 || h >= 335 }).length / chroma.length).toFixed(2)) : 0.3

  const s = (insp.designStyle || '').toLowerCase()
  const feat = (insp.features || []).join(' ').toLowerCase()
  const elegance = /premium|elegant|luxuri|hochwertig|edel|fine/.test(s) ? 0.85 : /clean|modern/.test(s) ? 0.4 : 0.3
  const minimalism = /minimal|clean|reduz/.test(s) ? 0.85 : /modern/.test(s) ? 0.5 : 0.25
  const cinematic = (darkness >= 0.5 ? 0.5 : 0) + (/dunkel|dark|cinematic|dramatic|premium|luxuri/.test(s) ? 0.5 : 0)
  const imagery = /galerie|gallery|foto|bild|vorher/.test(feat) ? 0.85 : 0.45
  const family = familyOf(`${insp.industry || ''} ${insp.companyName || ''} ${insp.designStyle || ''} ${insp.url || ''}`)

  return {
    darkness,
    warmth,
    saturation,
    elegance,
    minimalism,
    cinematic: Number(Math.min(1, cinematic).toFixed(2)),
    imagery,
    family,
    template: '',
    reasons: []
  }
}

/* ── Templates (Mood-basiert, industrie-neutral; Inhalt kommt aus layoutTemplateService) ── */
interface Template {
  archetype: StyleArchetype
  layoutType: string
  heroType: StyleProfile['heroType']
  backgroundStyle: StyleProfile['backgroundStyle']
  overlay: boolean
  navPosition: StyleProfile['navPosition']
  typographyMood: StyleProfile['typographyMood']
  fontCategory: StyleProfile['fontCategory']
  cornerRadius: StyleProfile['cornerRadius']
  spacingStyle: StyleProfile['spacingStyle']
  imageHeavy: boolean
  hasSlider: boolean
  cardStyle: string
  navigationStyle: string
  ctaStyle: string
  visualMood: string
  emotionalMood: string
  imageTreatment: string
  premiumSignals: string[]
  order: PreviewSectionType[]
}

export const TEMPLATES: Record<string, Template> = {
  'dark-cinematic': {
    archetype: 'dark-cinematic-restaurant',
    layoutType: 'Vollbild-Hero, dunkel, kinoreif',
    heroType: 'cinematic-full', backgroundStyle: 'dark', overlay: true, navPosition: 'over-hero',
    typographyMood: 'serif-display', fontCategory: 'serif', cornerRadius: 'scharf', spacingStyle: 'großzügig',
    imageHeavy: true, hasSlider: true,
    cardStyle: 'dunkle, randlose Flächen mit Goldakzent', navigationStyle: 'Nav über dem Hero, Logo zentriert',
    ctaStyle: 'eleganter Reservierungs-CTA + Buchungsleiste', visualMood: 'dunkel, elegant, cinematic',
    emotionalMood: 'edel, atmosphärisch', imageTreatment: 'große Bilder mit dunklem Overlay',
    premiumSignals: ['dunkles Overlay', 'große Serif-Headline', 'Letter-Spacing-Eyebrow'],
    order: ['header', 'hero', 'trust', 'services', 'gallery', 'about', 'reviews', 'contact', 'footer']
  },
  'gallery-driven': {
    archetype: 'light-premium-restaurant',
    layoutType: 'bildgetrieben, große Galerie früh',
    heroType: 'cinematic-full', backgroundStyle: 'light', overlay: true, navPosition: 'over-hero',
    typographyMood: 'modern-sans', fontCategory: 'sans', cornerRadius: 'soft', spacingStyle: 'ausgewogen',
    imageHeavy: true, hasSlider: true,
    cardStyle: 'bildbetonte Cards', navigationStyle: 'transparente Nav über Bild',
    ctaStyle: 'klarer CTA', visualMood: 'bildstark, lebendig', emotionalMood: 'einladend, visuell',
    imageTreatment: 'großflächige Fotostrecken', premiumSignals: ['Vollbild-Bilder', 'Galerie im Fokus'],
    order: ['header', 'hero', 'gallery', 'services', 'about', 'reviews', 'contact', 'footer']
  },
  'light-editorial': {
    archetype: 'light-premium-restaurant',
    layoutType: 'hell, redaktionell, viel Weißraum',
    heroType: 'centered', backgroundStyle: 'cream', overlay: false, navPosition: 'top-bar',
    typographyMood: 'serif-display', fontCategory: 'mixed', cornerRadius: 'soft', spacingStyle: 'großzügig',
    imageHeavy: false, hasSlider: false,
    cardStyle: 'ruhige helle Cards, feine Linien', navigationStyle: 'zentrierte Top-Nav, Logo mittig',
    ctaStyle: 'dezenter, eleganter CTA', visualMood: 'hell, editorial, edel', emotionalMood: 'ruhig, hochwertig',
    imageTreatment: 'ruhige, kuratierte Bilder', premiumSignals: ['Serif-Headlines', 'viel Weißraum', 'zentriertes Layout'],
    order: ['header', 'hero', 'services', 'about', 'gallery', 'reviews', 'contact', 'footer']
  },
  'elegant-split': {
    archetype: 'light-premium-restaurant',
    layoutType: 'Split-Hero, elegant, zweispaltig',
    heroType: 'split-image', backgroundStyle: 'light', overlay: false, navPosition: 'top-bar',
    typographyMood: 'serif-display', fontCategory: 'serif', cornerRadius: 'soft', spacingStyle: 'großzügig',
    imageHeavy: true, hasSlider: false,
    cardStyle: 'elegante Cards mit weichem Schatten', navigationStyle: 'klassische Top-Nav, Logo links',
    ctaStyle: 'klarer, eleganter CTA', visualMood: 'elegant, ausgewogen', emotionalMood: 'einladend, edel',
    imageTreatment: 'großes Hero-Bild rechts', premiumSignals: ['Split-Hero', 'Serif-Headline'],
    order: ['header', 'hero', 'about', 'services', 'gallery', 'reviews', 'contact', 'footer']
  },
  'minimal-luxury': {
    archetype: 'minimalist-agency',
    layoutType: 'minimalistisch, luxuriös, maximaler Weißraum',
    heroType: 'centered', backgroundStyle: 'light', overlay: false, navPosition: 'top-bar',
    typographyMood: 'modern-sans', fontCategory: 'sans', cornerRadius: 'scharf', spacingStyle: 'großzügig',
    imageHeavy: false, hasSlider: false,
    cardStyle: 'flache Cards, klare Kanten', navigationStyle: 'sehr reduzierte Nav',
    ctaStyle: 'schlanker, klarer CTA', visualMood: 'minimal, luxuriös, ruhig', emotionalMood: 'klar, exklusiv',
    imageTreatment: 'wenige, gezielte Bilder', premiumSignals: ['maximaler Weißraum', 'reduzierte Palette', 'scharfe Kanten'],
    order: ['header', 'hero', 'services', 'gallery', 'contact', 'footer']
  },
  'modern-minimal': {
    archetype: 'modern-local-business',
    layoutType: 'modern, klar, ausgewogen',
    heroType: 'split-image', backgroundStyle: 'light', overlay: false, navPosition: 'top-bar',
    typographyMood: 'modern-sans', fontCategory: 'sans', cornerRadius: 'soft', spacingStyle: 'ausgewogen',
    imageHeavy: false, hasSlider: false,
    cardStyle: 'weiche Cards mit dezentem Schatten', navigationStyle: 'klare Top-Nav mit CTA',
    ctaStyle: 'klarer CTA', visualMood: 'modern, sachlich', emotionalMood: 'sympathisch, klar',
    imageTreatment: 'konsistente Bilder', premiumSignals: ['klare Typo-Hierarchie', 'ausgewogenes Layout'],
    order: ['header', 'hero', 'trust', 'services', 'about', 'gallery', 'contact', 'footer']
  },
  'warm-local': {
    archetype: 'craftsman-trust',
    layoutType: 'warm, bodenständig, nahbar',
    heroType: 'split-image', backgroundStyle: 'cream', overlay: false, navPosition: 'top-bar',
    typographyMood: 'modern-sans', fontCategory: 'sans', cornerRadius: 'rund', spacingStyle: 'ausgewogen',
    imageHeavy: true, hasSlider: false,
    cardStyle: 'warme Cards mit runden Ecken', navigationStyle: 'klare Nav mit prominentem Kontakt-CTA',
    ctaStyle: 'einladender Kontakt-/Reservierungs-CTA', visualMood: 'warm, einladend, regional', emotionalMood: 'herzlich, nahbar',
    imageTreatment: 'echte, warme Bilder', premiumSignals: ['warme Farbwelt', 'runde Ecken', 'nahbare Bildsprache'],
    order: ['header', 'hero', 'trust', 'services', 'gallery', 'about', 'reviews', 'contact', 'footer']
  }
}

const ARCHETYPE_TO_TEMPLATE: Partial<Record<StyleArchetype, string>> = {
  'dark-cinematic-restaurant': 'dark-cinematic',
  'light-premium-restaurant': 'light-editorial',
  'luxury-service': 'minimal-luxury',
  'minimalist-agency': 'minimal-luxury',
  'automotive-premium': 'dark-cinematic',
  'craftsman-trust': 'warm-local',
  'medical-clean': 'modern-minimal',
  'modern-local-business': 'modern-minimal'
}

/** Wählt anhand des Fingerprints das passende Template (mit Seed-Variation & Override). */
export function selectTemplate(fp: StyleFingerprint, controls?: StyleControls): { id: string; reasons: string[] } {
  if (controls?.archetypeOverride && ARCHETYPE_TO_TEMPLATE[controls.archetypeOverride])
    return { id: ARCHETYPE_TO_TEMPLATE[controls.archetypeOverride]!, reasons: ['manueller Archetyp'] }

  const refined = Math.max(fp.elegance, fp.minimalism) // „gehoben“ → dämpft warm-local/modern
  const scores: Record<string, number> = {
    'dark-cinematic': fp.cinematic * 1.3 + fp.darkness * 1.0,
    'gallery-driven': fp.imagery * 1.2 + fp.saturation * 0.3 + (fp.darkness < 0.45 ? 0.2 : 0),
    'light-editorial': fp.elegance * 1.2 + (1 - fp.darkness) * 0.7,
    'elegant-split': fp.elegance * 1.0 + (1 - fp.darkness) * 0.6 + fp.imagery * 0.3,
    'minimal-luxury': fp.minimalism * 1.4 + (1 - fp.darkness) * 0.3,
    'modern-minimal': (1 - fp.elegance) * 0.5 + (1 - fp.darkness) * 0.4 + fp.minimalism * 0.35,
    'warm-local': fp.warmth * 1.0 * (1 - refined * 0.6) + (1 - fp.darkness) * 0.3
  }
  // Seed-Variation: bei nahezu gleichauf liegenden Templates die zweite Wahl zulassen
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const seed = controls?.compositionSeed || 0
  let pick = ranked[0]
  const tieGap = controls?.forceReferenceStyle ? 0.12 : 0.22
  if (seed > 0 && ranked[1] && ranked[0][1] - ranked[1][1] < tieGap) pick = seed % 2 === 1 ? ranked[1] : ranked[0]
  const reasons = [
    `Template „${pick[0]}“ (Score ${pick[1].toFixed(2)})`,
    `dark ${fp.darkness} · elegant ${fp.elegance} · minimal ${fp.minimalism} · cinematic ${fp.cinematic} · warm ${fp.warmth} · imagery ${fp.imagery}`
  ]
  return { id: pick[0], reasons }
}

/** Baut das vollständige Stilprofil aus Fingerprint + Template + Reglern. */
export function buildStyleProfile(insp: InspirationReference, controls?: StyleControls): { profile: StyleProfile; fingerprint: StyleFingerprint } {
  const fp = computeFingerprint(insp)
  const sel = selectTemplate(fp, controls)
  fp.template = sel.id
  fp.reasons = sel.reasons
  const tpl = TEMPLATES[sel.id]
  const restaurant = fp.family === 'gastronomy'

  // Sektionsreihenfolge: bei Restaurant „services“ → „menu“
  let order: PreviewSectionType[] = tpl.order.map((s) => (restaurant && s === 'services' ? 'menu' : s))
  // Seed: Galerie/Über-uns tauschen für sichtbar andere Komposition
  const seed = controls?.compositionSeed || 0
  if (seed % 2 === 1) {
    const gi = order.indexOf('gallery')
    const ai = order.indexOf('about')
    if (gi > -1 && ai > -1) [order[gi], order[ai]] = [order[ai], order[gi]]
  }

  let backgroundStyle = tpl.backgroundStyle
  let typographyMood = tpl.typographyMood
  let cornerRadius = tpl.cornerRadius
  let spacingStyle = tpl.spacingStyle
  let imageHeavy = tpl.imageHeavy
  let darkness = backgroundStyle === 'dark' ? Math.max(0.78, fp.darkness) : fp.darkness
  const premiumSignals = [...tpl.premiumSignals]

  // Regler
  if (controls?.darknessOverride === 'darker') { backgroundStyle = 'dark'; darkness = Math.max(0.8, darkness) }
  else if (controls?.darknessOverride === 'lighter') { backgroundStyle = backgroundStyle === 'dark' ? 'cream' : 'light'; darkness = Math.min(0.25, darkness) }
  if (controls?.imageryOverride === 'more') { imageHeavy = true; if (!order.includes('gallery')) order.splice(Math.max(1, order.length - 3), 0, 'gallery') }
  else if (controls?.imageryOverride === 'less') imageHeavy = false
  if (controls?.luxury) { typographyMood = 'serif-display'; spacingStyle = 'großzügig'; premiumSignals.push('luxuriöse Anmutung') }
  if (controls?.modern && tpl.heroType !== 'cinematic-full') { typographyMood = 'modern-sans'; cornerRadius = 'soft' }

  const profile: StyleProfile = {
    archetype: tpl.archetype,
    layoutType: tpl.layoutType,
    heroType: tpl.heroType,
    backgroundStyle,
    overlay: tpl.overlay || backgroundStyle === 'dark',
    navPosition: tpl.navPosition,
    sectionOrder: order,
    visualMood: tpl.visualMood,
    emotionalMood: tpl.emotionalMood,
    spacingStyle,
    cornerRadius,
    cardStyle: tpl.cardStyle,
    navigationStyle: tpl.navigationStyle,
    ctaStyle: tpl.ctaStyle,
    colorMood: insp.colors.length ? `abgeleitet aus ${insp.colors.slice(0, 3).join(', ')}` : 'template-typisch',
    typographyMood,
    fontCategory: tpl.fontCategory,
    darkness,
    imageHeavy,
    hasSlider: tpl.hasSlider,
    imageTreatment: tpl.imageTreatment,
    premiumSignals: Array.from(new Set(premiumSignals))
  }
  return { profile, fingerprint: fp }
}

/** Layout-Signatur (für Uniqueness-Vergleich) – enthält die aus B übernommene Struktur. */
export function layoutSignature(p: StyleProfile): string {
  return [
    p.archetype,
    p.heroType,
    p.heroAlign || 'center',
    p.logoCenter ? 'logoC' : 'logoL',
    p.navHasCta ? 'navCta' : 'navPlain',
    p.typographyMood,
    p.spacingStyle,
    p.cornerRadius,
    p.backgroundStyle,
    p.navPosition,
    `foot${p.footerColumns || 1}`,
    p.sectionOrder.join('-')
  ].join('|')
}
