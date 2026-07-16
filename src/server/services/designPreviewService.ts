import type {
  DesignPreviewInput,
  DesignPreviewResult,
  SourceCompany,
  GeneratedHomepageConcept,
  StyleControls,
  StyleProfile,
  PreviewPalette,
  StyleMatch,
  BrandProfile,
  PresentationQuality,
  PreviewImagePlacement,
  ImageFitScore,
  InspirationReference,
  StyleFingerprint,
  ReferenceBlueprint
} from '@shared/types'
import { buildStyleProfile, layoutSignature } from './styleFingerprintService'
import { extractReferenceBlueprint, blueprintMatchScore, blueprintSectionPlan } from './referenceBlueprintService'
import { logoInitials } from './brandAdapterService'
import { buildBrandProfile } from './brandProfileService'
import { mapColors } from './colorMappingService'
import { buildSections } from './layoutTemplateService'
import { mapImagesToSections } from './previewImageMapper'
import { computeStyleMatch } from './styleMatchService'
import { computePresentationQuality } from './presentationQualityService'
import { BrowserManager } from './browser'
import { analyzeTarget } from './targetAnalyzer'
import { extractWebsiteImages } from './websiteImageExtractionService'
import { detectBrandColors } from './brandColorDetectionService'
import { selectBrandHexes } from './colorRoleMapper'
import { contrast, parseHex, hue, sat } from './colorUtils'
import { saveCustomerPalette, loadCustomerPalette } from './customerPaletteStorage'
import { normalizeUrl, getDomain } from '../utils/url'
import { log } from '../utils/logger'

export const PREVIEW_LEGAL_NOTE =
  'Diese Vorschau ist nur ein eigenes Konzept auf Basis allgemeiner Stil-Inspiration. Bilder & Inhalte stammen – wo möglich – von Kunde A. Keine Inhalte, Bilder, Logos, Texte, Codes oder exakten Layouts der Referenzseite übernehmen.'

const VISUAL_THRESHOLD = 75
const MATCH_THRESHOLD = 80

async function enrichSourceFromUrl(source: SourceCompany): Promise<SourceCompany> {
  const url = source.url ? normalizeUrl(source.url) : null
  if (!url) return source
  const bm = new BrowserManager(true)
  try {
    const t = await analyzeTarget(bm, { url, maxResults: 0, manualUrls: [], country: 'Germany' })
    let images = source.websiteImages
    if (t.reachable && (!images || images.length === 0)) {
      images = await extractWebsiteImages(bm, t.finalUrl)
    }
    // Zuverlässige Markenfarben (CSS-Vars/Buttons/Nav) – ersetzt rohe Screenshot-Farben.
    // Gespeicherte Domain-Palette wird wiederverwendet (kein Neu-Raten bei jedem Lauf).
    let detected = source.detectedColors
    let cookieFiltered = source.cookieFiltered
    if (t.reachable && (!detected || detected.length === 0)) {
      const domain = getDomain(t.finalUrl)
      const saved = loadCustomerPalette(domain)
      if (saved?.detected?.length) {
        detected = saved.detected
        log.info(`Gespeicherte Kundenpalette für ${domain} wiederverwendet (${saved.updatedAt}).`)
      } else {
        const res = await detectBrandColors(bm, t.finalUrl)
        detected = res.colors
        cookieFiltered = res.cookieFound
        if (detected.length) {
          const roles: Partial<Record<import('@shared/types').ColorRole, string>> = {}
          for (const d of detected) if (d.include && !roles[d.role]) roles[d.role] = d.hex
          saveCustomerPalette({ domain, updatedAt: '', detected, roles, overallConfidence: Math.max(0, ...detected.map((d) => d.confidence)) })
        }
      }
    }
    const detectedHexes = selectBrandHexes(detected || [])
    if (!t.reachable) return { ...source, websiteImages: images, detectedColors: detected, cookieFiltered }
    return {
      ...source,
      name: source.name?.trim() || t.companyName || source.name,
      industry: source.industry || t.industry,
      location: source.location || t.location,
      targetGroup: source.targetGroup || t.targetAudience,
      services: source.services.length ? source.services : t.services,
      colors: source.colors,
      // erkannte Marken-Hex bevorzugen, sonst Snapshot-Farben als Stütze
      websiteColors: source.websiteColors?.length ? source.websiteColors : detectedHexes.length ? detectedHexes : t.colors.map((c) => c.hex),
      detectedColors: detected,
      cookieFiltered,
      screenshot: t.screenshotDesktop,
      websiteImages: images,
      weaknesses: t.weaknesses,
      fromAnalysis: true
    }
  } catch (e) {
    log.warn('Kunde-A-Analyse fehlgeschlagen:', e)
    return source
  } finally {
    await bm.close()
  }
}

function refDarkness(colors: string[]): number {
  const lum = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) return null
    const n = parseInt(m[1], 16)
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  }
  const l = colors.map(lum).filter((x): x is number => x != null)
  if (!l.length) return 0.4
  return 1 - l.reduce((a, b) => a + b, 0) / l.length
}

interface Built {
  profile: StyleProfile
  fingerprint: StyleFingerprint
  signature: string
  brand: BrandProfile
  palette: PreviewPalette
  concept: GeneratedHomepageConcept
  styleMatch: StyleMatch
  scores: PresentationQuality
  brandStrength: number
  winner: string
  paletteSources: Record<string, string>
  placements: PreviewImagePlacement[]
  imageSummary: { found: number; used: number; placeholders: number; recommendations: string[]; fit?: ImageFitScore }
}

/**
 * Übersteuert das Template-Profil mit der ECHTEN Referenz-Struktur (Blueprint).
 * Regel: Hat B einen Vollbild-Hero, bekommt die Vorschau einen Vollbild-Hero usw.
 * Nutzer-Overrides (dunkler/heller, Archetyp) behalten Vorrang.
 */
function applyBlueprint(profile: ReturnType<typeof buildStyleProfile>['profile'], bp: ReferenceBlueprint, controls: StyleControls, restaurant: boolean): void {
  if (!bp.ok) return
  profile.heroType = bp.heroType === 'standard' ? profile.heroType : bp.heroType
  profile.overlay = bp.heroOverlay || bp.heroType === 'cinematic-full'
  profile.navPosition = bp.navPosition
  profile.typographyMood = bp.typography
  profile.fontCategory = bp.typography === 'serif-display' ? 'serif' : 'sans'
  profile.cornerRadius = bp.cornerRadius
  profile.hasSlider = bp.hasSlider
  profile.imageHeavy = bp.imageDominant || profile.imageHeavy
  if (!controls.darknessOverride) {
    profile.backgroundStyle = bp.backgroundStyle
    profile.darkness = bp.backgroundStyle === 'dark' ? Math.max(0.75, bp.darkness) : bp.darkness
  }
  profile.layoutType = `aus Referenz-Blueprint: ${bp.notes.join(', ') || 'Struktur übernommen'}`

  // ── KERN: Sektionsreihenfolge aus der ECHTEN B-Struktur (ersetzt Template-Order) ──
  const plan = blueprintSectionPlan(bp, restaurant)
  let order = plan.order
  // Kompositions-Variation: zwei mittlere Inhaltssektionen tauschen (Struktur bleibt B-treu)
  const seed = controls.compositionSeed || 0
  if (seed % 3 !== 0) {
    const mid = order.map((o, i) => ({ o, i })).filter((x) => !['header', 'hero', 'contact', 'footer'].includes(x.o))
    if (mid.length >= 2) {
      const k = seed % (mid.length - 1)
      const a = mid[k].i
      const b = mid[k + 1].i
      ;[order[a], order[b]] = [order[b], order[a]]
    }
  }
  profile.sectionOrder = order

  // ── Struktur-Merkmale aus B ins Profil (für Renderer + Signatur) ──
  profile.heroAlign = bp.heroTextAlign
  profile.logoCenter = bp.logoPosition === 'center'
  profile.navHasCta = bp.navHasCta
  profile.footerColumns = bp.footerColumns
  profile.blueprintDriven = true
  profile.premiumSignals = Array.from(new Set([...profile.premiumSignals, ...bp.notes]))
}

function buildOnce(source: SourceCompany, insp: InspirationReference, controls: StyleControls, seed: number, blueprint?: ReferenceBlueprint): Built {
  const { profile, fingerprint } = buildStyleProfile(insp, { ...controls, compositionSeed: (controls.compositionSeed || 0) + seed })
  if (blueprint) applyBlueprint(profile, blueprint, { ...controls, compositionSeed: (controls.compositionSeed || 0) + seed }, fingerprint.family === 'gastronomy')
  const signature = layoutSignature(profile)
  const brand = buildBrandProfile(source, controls)
  const { palette, brandStrength, winner, sources: paletteSources } = mapColors(profile, brand, insp, controls)
  const { sections, navItems } = buildSections(source, profile, seed)
  const useImages = controls.useCustomerImages !== false
  const { placements, summary } = mapImagesToSections(sections, source.websiteImages || [], profile, useImages)

  const concept: GeneratedHomepageConcept = {
    companyName: source.name?.trim() || '[Firmenname]',
    logoDataUrl: source.logoDataUrl,
    logoText: source.name?.trim() || logoInitials(source.name || 'LL'),
    archetype: profile.archetype,
    heroType: profile.heroType,
    backgroundStyle: profile.backgroundStyle,
    overlay: profile.overlay,
    fontCategory: profile.fontCategory,
    imageHeavy: profile.imageHeavy,
    palette,
    radius: profile.cornerRadius,
    spacing: profile.spacingStyle,
    typography: profile.typographyMood,
    navItems,
    sections,
    heroAlign: profile.heroAlign,
    logoCenter: profile.logoCenter,
    navHasCta: profile.navHasCta,
    footerColumns: profile.footerColumns
  }
  const styleMatch = computeStyleMatch(profile, palette, insp)
  // Paletten-Genauigkeit: wie nah liegt CTA/Akzent an einer echten Marken-Farbe von A?
  const brandRef = [...(source.colors || []), ...(source.logoColors || []), ...selectBrandHexes(source.detectedColors || [])]
  const paletteAccuracy = brandRef.length ? paletteAccuracyScore(palette, brandRef) : 55
  const scores = { ...computePresentationQuality(styleMatch.score, brandStrength, brand, !!source.logoDataUrl, summary.fit?.score), paletteAccuracy }
  return { profile, fingerprint, signature, brand, palette, paletteSources, concept, styleMatch, scores, brandStrength, winner, placements, imageSummary: summary }
}

/**
 * Paletten-Genauigkeit: CTA per FARBTON-Nähe (Lesbarkeits-Abdunklung ist gewollt,
 * der Marken-Farbton muss stimmen) + Hintergrund per RGB-Nähe zum Kundenpool.
 */
function paletteAccuracyScore(palette: PreviewPalette, brandRef: string[]): number {
  const refs = brandRef.map(parseHex).filter((c): c is NonNullable<ReturnType<typeof parseHex>> => !!c)
  if (!refs.length) return 50
  const rgbScore = (hex: string) => {
    const x = parseHex(hex)
    if (!x) return 50
    let best = 999
    for (const y of refs) best = Math.min(best, Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2))
    return Math.max(0, Math.min(100, Math.round(100 - (best / 441) * 110)))
  }
  const hueScore = (hex: string) => {
    const x = parseHex(hex)
    if (!x) return 50
    if (sat(x) <= 0.1) return rgbScore(hex) // neutral → RGB-Vergleich
    let best = 0
    for (const y of refs) {
      if (sat(y) <= 0.1) continue
      const dh = Math.abs(hue(x) - hue(y))
      const d = Math.min(dh, 360 - dh)
      best = Math.max(best, Math.max(0, Math.round(100 - d * 1.8)))
    }
    return best || rgbScore(hex)
  }
  return Math.round(rgbScore(palette.paper) * 0.4 + hueScore(palette.cta) * 0.6)
}

export async function generateDesignPreview(input: DesignPreviewInput): Promise<DesignPreviewResult> {
  let source = input.source
  if (input.analyzeSourceUrl && source.url) source = await enrichSourceFromUrl(source)
  // Erkannte (ein-/ausgeschaltete) Farben als Website-Markenfarben verwenden → Toggles wirken sofort
  if (source.detectedColors?.length) source = { ...source, websiteColors: selectBrandHexes(source.detectedColors) }

  const seed = input.seed || 0
  let controls: StyleControls = { referenceStrength: 0.8, ...input.controls }

  // ── Referenz B LIVE analysieren → Blueprint (kein Template-Raten) ──
  let blueprint: ReferenceBlueprint | undefined = input.referenceBlueprint
  if (!blueprint && !input.skipReferenceAnalysis && input.inspiration.url) {
    const bm = new BrowserManager(true)
    try {
      blueprint = await extractReferenceBlueprint(bm, input.inspiration.url)
    } finally {
      await bm.close()
    }
  }

  let built = buildOnce(source, input.inspiration, controls, seed, blueprint)

  // Bei zu geringem Style-Match automatisch stärkeres Matching versuchen.
  if (built.styleMatch.score < MATCH_THRESHOLD && !input.controls?.archetypeOverride) {
    const strong: StyleControls = {
      ...controls,
      referenceStrength: 1,
      lessGeneric: true,
      // Blueprint kennt die ECHTE Helligkeit der Referenz → nicht aus Farben raten
      darknessOverride: controls.darknessOverride || (!blueprint?.ok && refDarkness(input.inspiration.colors) >= 0.5 ? 'darker' : undefined),
      imageryOverride: controls.imageryOverride || ((input.inspiration.features || []).some((f) => /galerie|gallery|bild|foto/i.test(f)) ? 'more' : undefined)
    }
    const stronger = buildOnce(source, input.inspiration, strong, seed, blueprint)
    if (stronger.styleMatch.score >= built.styleMatch.score) {
      built = stronger
      controls = strong
    }
  }

  // 3 Konzeptvarianten (Referenznah / Ausgewogen / Markenfokus)
  // 3 Kompositions-Varianten (Farben immer Kunde A, Struktur immer Blueprint – nur Sektionsrhythmus variiert)
  const variantDefs: { label: string; s: number }[] = [
    { label: 'Komposition A', s: 0 },
    { label: 'Komposition B', s: 1 },
    { label: 'Komposition C', s: 2 }
  ]
  const variants = variantDefs.map((v) => {
    const b = buildOnce(source, input.inspiration, controls, seed + v.s, blueprint)
    return { label: v.label, concept: b.concept, scores: b.scores }
  })

  // Blueprint-Treue: folgt das Konzept der ECHTEN Referenz-Struktur?
  const generatedBlocks =
    blueprint?.ok ? blueprintSectionPlan(blueprint, built.fingerprint.family === 'gastronomy').blocks : []
  const bpMatch = blueprint
    ? blueprintMatchScore(
        blueprint,
        { ...built.concept, heroAlign: built.concept.heroAlign, navHasCta: built.concept.navHasCta },
        built.profile.navPosition === 'over-hero',
        generatedBlocks
      )
    : undefined

  // ── Farb-Validierung (echte Messungen) ──
  const pal = built.palette
  const brandRef = [...(source.colors || []), ...(source.logoColors || []), ...selectBrandHexes(source.detectedColors || [])]
  const dist = (a: string, b: string) => {
    const x = parseHex(a)
    const y = parseHex(b)
    if (!x || !y) return 999
    return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2)
  }
  const nearest = brandRef.length ? Math.min(...brandRef.map((b) => dist(pal.cta, b))) : 999
  const brandColorMatch = brandRef.length === 0 ? 50 : Math.max(0, Math.min(100, Math.round(100 - (nearest / 441) * 130)))
  const ct = parseHex(pal.ink) && parseHex(pal.paper) ? contrast(parseHex(pal.ink)!, parseHex(pal.paper)!) : 1
  const ctaCt = parseHex(pal.accentInk) && parseHex(pal.cta) ? contrast(parseHex(pal.accentInk)!, parseHex(pal.cta)!) : 1
  const contrastScore = Math.max(0, Math.min(100, Math.round(((Math.min(ct, ctaCt) - 1) / 6) * 100)))
  const valWarnings: string[] = []
  if (Math.min(ct, ctaCt) < 3) valWarnings.push('Diese Farbkombination hat zu wenig Kontrast. Bitte hellere/dunklere Variante nutzen.')
  const maxConf = Math.max(0, ...(source.detectedColors || []).map((d) => d.confidence))
  if ((source.detectedColors || []).length > 0 && maxConf < 70 && !(source.colors || []).length && !(source.logoColors || []).length)
    valWarnings.push('Die automatisch erkannten Farben wirken unsicher. Bitte Palette manuell bestätigen.')
  if (source.cookieFiltered) valWarnings.push('Cookie-/Widget-Farben wurden bewusst nicht als Markenfarben übernommen.')

  // ── EHRLICHE SCORES: aus messbaren Prüfungen, nicht aus Konfiguration ──
  const scoreReasons: string[] = []
  const visualScore = input.inspiration.visualScore ?? input.inspiration.score
  // Kundenfarben sind IMMER Pflicht, sobald Kunde A Farben liefert
  const customerMode = brandRef.length > 0
  const pa = built.scores.paletteAccuracy ?? 0

  // Style: Blueprint-Treue ist der Maßstab; ohne Blueprint max. 50, Fallback-Template max. 60
  let styleScore: number
  if (blueprint?.ok && bpMatch) {
    styleScore = bpMatch.score
    scoreReasons.push(`Style ${styleScore}: Blueprint-Treue (echte Referenz-Struktur geprüft)${bpMatch.notes.length ? ' – Abweichungen: ' + bpMatch.notes.join('; ') : ''}`)
    built.styleMatch = { ...built.styleMatch, score: bpMatch.score, notes: bpMatch.notes }
  } else {
    styleScore = Math.min(built.styleMatch.score, 50)
    scoreReasons.push(`Style ${styleScore} (max. 50): Referenz-Blueprint nicht genutzt – keine Referenz-URL (nur Schätzung, kein echtes Struktur-Matching).`)
  }
  if (blueprint && !blueprint.ok) {
    styleScore = Math.min(styleScore, 60)
    scoreReasons.push('Style auf max. 60 begrenzt: Fallback-Template genutzt – Referenz wurde nicht vollständig übernommen.')
  }

  // ── Layout-Differenz-Prüfung: Referenzwechsel muss sichtbar anderes Layout ergeben ──
  let layoutStale = false
  if (input.previousSignature && input.previousReferenceUrl && input.inspiration.url) {
    const refChanged = normalizeUrl(input.previousReferenceUrl) !== normalizeUrl(input.inspiration.url)
    if (refChanged && input.previousSignature === built.signature) {
      layoutStale = true
      styleScore = Math.min(styleScore, 65)
      scoreReasons.push('Style auf max. 65 begrenzt: Layout trotz anderer Referenz nahezu identisch – Blueprint nicht korrekt angewendet.')
    }
  }

  // Brand: aus tatsächlicher Paletten-Genauigkeit + echt genutzten Assets
  let brandScore = Math.round(
    (brandRef.length ? pa : 40) * 0.6 +
      (source.logoDataUrl ? 15 : 0) +
      (built.imageSummary.used > 0 ? 15 : 0) +
      (brandRef.length ? 10 : 0)
  )
  brandScore = Math.max(0, Math.min(100, brandScore))
  scoreReasons.push(
    `Brand ${brandScore}: Paletten-Genauigkeit ${brandRef.length ? pa : 'n/a'} · Logo ${source.logoDataUrl ? 'ja' : 'nein'} · echte Bilder ${built.imageSummary.used} · Marken-Farben ${brandRef.length ? 'vorhanden' : 'fehlen'}`
  )
  if (customerMode && pa < 85) {
    brandScore = Math.min(brandScore, 60)
    scoreReasons.push(`Brand auf max. 60 begrenzt: Kundenfarben nicht präzise genug übernommen (Genauigkeit ${pa} < 85).`)
  }
  // Strikte Prüfung: finale CTA-Farbe darf NIE näher an Referenz B als an Kunde A liegen
  let customerOnlyViolation = false
  if (brandRef.length && input.inspiration.colors.length && !controls.paletteLocked) {
    const dRef = Math.min(...input.inspiration.colors.map((b) => dist(pal.cta, b)))
    if (dRef + 12 < nearest) {
      customerOnlyViolation = true
      brandScore = Math.min(brandScore, 60)
      scoreReasons.push('VERSTOSS: Finale CTA-Farbe liegt näher an Referenz B als an Kunde A – Kundenfarben nicht durchgesetzt.')
    }
  }

  // Presentable: aus echten Signalen (Struktur-Treue, Kontrast, Bilder, Platzhalter-Anteil)
  const placeholderScore = built.imageSummary.placeholders === 0 ? 100 : built.imageSummary.placeholders === 1 ? 80 : 55
  const presentable = Math.max(
    0,
    Math.min(100, Math.round(styleScore * 0.3 + contrastScore * 0.25 + (built.imageSummary.fit?.score ?? 60) * 0.3 + placeholderScore * 0.15))
  )
  scoreReasons.push(`Presentable ${presentable}: Struktur ${styleScore} · Kontrast ${contrastScore} · Bild-Fit ${built.imageSummary.fit?.score ?? 'n/a'} · Platzhalter ${built.imageSummary.placeholders}`)

  // Optisch schwache Referenz blockiert „ready“, außer der Nutzer erzwingt sie
  const weakRefUnforced = visualScore != null && visualScore < VISUAL_THRESHOLD && !controls.forceReferenceStyle

  // Unsichere Palette blockiert „ready“: Erkennung schwach UND keine manuelle/Logo-Bestätigung
  const bestDetectedConf = Math.max(0, ...(source.detectedColors || []).map((d) => d.confidence))
  const paletteUnsure =
    !(source.colors || []).length &&
    !(source.logoColors || []).length &&
    !controls.paletteLocked &&
    ((source.detectedColors || []).length === 0 || bestDetectedConf < 70)
  if (paletteUnsure) scoreReasons.push('Kundenvorschau blockiert: Markenfarben nicht sicher erkannt – Palette bestätigen/sperren.')

  built.scores = {
    ...built.scores,
    style: styleScore,
    brand: brandScore,
    presentable,
    ready:
      styleScore >= 80 &&
      brandScore >= 80 &&
      presentable >= 85 &&
      !(customerMode && pa < 85) &&
      !customerOnlyViolation &&
      !weakRefUnforced &&
      !paletteUnsure
  }

  const warnings: string[] = []
  if (layoutStale) warnings.push('Die Vorschau nutzt noch zu stark das alte Template. Blueprint wurde nicht korrekt angewendet – bitte „Frisches Layout“/„Aus Referenz neu analysieren“.')
  if (blueprint && !blueprint.ok) warnings.push('Fallback-Template genutzt – Referenz wurde nicht vollständig übernommen. Vorschau ist nicht kundentauglich (Style Match ≤ 60).')
  if (!blueprint) warnings.push('Referenz hat keine URL – Struktur konnte nicht live geprüft werden (Style Match max. 60, „nicht geprüft“).')
  if (bpMatch && bpMatch.score < 80)
    warnings.push('Die Vorschau folgt der Referenz noch nicht stark genug. Bitte „Referenzstruktur stärker übernehmen“. ' + bpMatch.notes.join('; '))
  if (weakRefUnforced)
    warnings.push(`Referenz optisch schwach bewertet (Score ${visualScore}) – nicht als Designvorlage empfohlen. „Referenzstruktur stärker übernehmen“ erzwingt die Nutzung als Strukturvorlage.`)
  if (visualScore != null && visualScore < VISUAL_THRESHOLD && controls.forceReferenceStyle)
    warnings.push('Diese Vorschau nutzt die Referenzstruktur, obwohl die Referenz optisch nicht als Top-Design bewertet wurde.')
  if (customerMode && pa < 85)
    warnings.push(`Die Kundenfarben wurden noch nicht präzise genug übernommen (Genauigkeit ${pa}). Bitte Palette bestätigen/korrigieren oder sperren.`)
  if (!customerMode)
    warnings.push('Keine Kundenfarben gefunden – neutrale Fallback-Palette. Bitte Farben manuell setzen, Logo hochladen oder Website analysieren; Kundenvorschau bleibt blockiert.')
  if (paletteUnsure && customerMode)
    warnings.push('Die Markenfarben konnten nicht sicher erkannt werden. Bitte Palette bestätigen (Farben prüfen/sperren).')
  if (customerOnlyViolation)
    warnings.push('Referenzfarben in den finalen Werten erkannt – Kundenfarben nicht durchgesetzt, „bereit für Kundenvorschau“ blockiert.')
  if (built.scores.brand < MATCH_THRESHOLD && !warnings.some((w) => w.startsWith('Die Kundenfarben')))
    warnings.push('Brand Match < 80: Kundenbranding noch schwach. Logo hochladen, Marken-Farben setzen oder „Kundenfarben erzwingen“.')
  if (!source.logoDataUrl) warnings.push('Kein Logo hinterlegt – Text-Logo wird genutzt. Logo später ergänzen.')
  if (built.brand.source === 'default') warnings.push('Keine Marken-Farben erkannt – neutrale Palette. Logo-Farben anwenden oder Farben manuell setzen.')

  const colorValidation = { brandColorMatch, contrast: contrastScore, stylePreservation: styleScore, warnings: valWarnings }

  const sp = built.profile
  const designDecision = {
    fromReference: [`Layout/Archetyp: ${sp.layoutType}`, `Hero: ${sp.heroType}, Navigation: ${sp.navPosition}`, `Stimmung: ${sp.visualMood}`, `Typografie: ${sp.typographyMood === 'serif-display' ? 'elegante Serif' : 'moderne Sans'}`],
    fromCustomer: [
      `Logo: ${source.logoDataUrl ? 'Original-Logo' : 'Text-Logo'}`,
      `Marken-Farben: ${(source.colors?.length ? source.colors : source.logoColors || []).slice(0, 3).join(', ') || 'neutral'}`,
      `Inhalte/Leistungen: ${(source.services || []).slice(0, 3).join(', ') || 'allgemein'}`,
      built.imageSummary.used > 0 ? `${built.imageSummary.used} echte Bilder von der Website` : 'Bilder als Platzhalter'
    ],
    colorAdaptation: `${built.winner}; Akzent ${built.palette.accent}, CTA ${built.palette.cta} (Branding-Stärke ${built.brandStrength}/100).`,
    presentation: built.scores.ready ? 'Bereit für Kundenvorschau.' : 'Noch optimieren (Scores < Schwelle).'
  }

  return {
    concept: built.concept,
    styleProfile: built.profile,
    fingerprint: built.fingerprint,
    chosenTemplate: blueprint?.ok ? `blueprint (echte B-Struktur)` : `Fallback-Template: ${built.fingerprint.template}`,
    layoutSignature: built.signature,
    fallbackUsed: blueprint ? !blueprint.ok : true,
    layoutStale,
    generatedSectionOrder: built.concept.sections.map((s) => s.type),
    referenceBlueprint: blueprint,
    blueprintMatch: bpMatch,
    styleMatch: built.styleMatch,
    brandProfile: built.brand,
    brandTransferMode: controls.brandMode || 'auto',
    brandStrength: built.brandStrength,
    scores: built.scores,
    imagePlacements: built.placements,
    imageSummary: built.imageSummary,
    brandSource: {
      logoColors: source.logoColors || [],
      websiteColors: source.websiteColors || [],
      manualColors: source.colors || [],
      finalPalette: built.palette,
      winner: built.winner
    },
    paletteSources: built.paletteSources,
    scoreReasons,
    detectedColors: source.detectedColors,
    colorValidation,
    designDecision,
    inspiration: {
      name: input.inspiration.companyName,
      url: input.inspiration.url,
      designStyle: input.inspiration.designStyle,
      colors: input.inspiration.colors,
      visualScore,
      screenshot: input.inspiration.screenshot
    },
    sourceScreenshot: source.screenshot,
    controls,
    variants,
    warnings,
    legalNote: PREVIEW_LEGAL_NOTE
  }
}

export { VISUAL_THRESHOLD, MATCH_THRESHOLD }
