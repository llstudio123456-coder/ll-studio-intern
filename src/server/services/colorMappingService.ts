import type { StyleProfile, BrandProfile, PreviewPalette, BrandTransferMode, InspirationReference, StyleControls } from '@shared/types'
import { parseHex, toHex, lum, sat, mix, lighten, darken, ensureReadable, type RGB } from './colorUtils'

const GOLD: RGB = { r: 176, g: 141, b: 87 }
const WHITE: RGB = { r: 255, g: 255, b: 255 }

/** Akzent der Referenz B aus deren Farben (mid-saturated), sonst warmes Gold. */
function referenceAccent(insp: InspirationReference): RGB {
  const cands = insp.colors.map(parseHex).filter((c): c is RGB => !!c)
  const acc = cands.filter((c) => sat(c) > 0.2 && lum(c) > 0.18 && lum(c) < 0.9).sort((a, b) => sat(b) - sat(a))[0]
  return acc || GOLD
}

export interface MappingResult {
  palette: PreviewPalette
  brandStrength: number
  mode: BrandTransferMode
  winner: string
  /** Herkunft jedes finalen Tokens (für Debug + Validierung) */
  sources: Record<string, string>
}

/** Marken-Rollen von Kunde A (dunkelster/hellster Ton + Akzente). */
function customerRoles(brand: BrandProfile) {
  const accent = parseHex(brand.accent) || GOLD
  const primary = parseHex(brand.primary) || accent
  const secondary = parseHex(brand.secondary) || primary
  const dark = parseHex(brand.neutralDark) || { r: 26, g: 23, b: 26 }
  const light = parseHex(brand.neutralLight) || { r: 250, g: 247, b: 241 }
  return { accent, primary, secondary, dark, light }
}

/** Baut eine Palette VOLLSTÄNDIG aus Kunde-A-Rollen (Referenz liefert nur die Rollenstruktur). */
function customerPalette(profile: StyleProfile, brand: BrandProfile, blend: number): { palette: PreviewPalette; sources: Record<string, string> } {
  const { accent, secondary, dark, light } = customerRoles(brand)
  const dark_ = profile.backgroundStyle === 'dark'
  const src = (role: string) => `Kunde A (${brand.source}) → ${role}`
  const sources: Record<string, string> = {}

  if (dark_) {
    // Referenz-Rolle „dunkler Hintergrund“ → dunkelster geeigneter Kunden-Ton
    let paper = dark
    let guard = 0
    while (lum(paper) > 0.12 && guard++ < 10) paper = darken(paper, 0.18)
    if (blend > 0) paper = mix(paper, { r: 20, g: 16, b: 21 }, blend)
    const surface = lighten(paper, 0.07)
    let ink = light
    ink = ensureReadable(ink, paper, 6)
    let acc = accent
    if (lum(acc) < 0.35) acc = lighten(acc, 0.35)
    const cta = acc
    sources['--preview-bg'] = src('dunkelster Markenton')
    sources['--preview-surface'] = src('dunkelster Markenton (aufgehellt)')
    sources['--preview-text'] = src('hellster Markenton, lesbar gemacht')
    sources['--preview-accent'] = sources['--preview-cta'] = src('Marken-Akzent')
    return {
      palette: {
        primary: toHex(lighten(accent, 0.1)),
        secondary: toHex(secondary),
        cta: toHex(cta),
        ctaHover: toHex(lighten(cta, 0.12)),
        paper: toHex(paper),
        surface: toHex(surface),
        ink: toHex(ink),
        muted: toHex(mix(ink, paper, 0.35)),
        accent: toHex(acc),
        accentInk: lum(acc) > 0.62 ? '#1a1712' : '#ffffff',
        line: 'rgba(255,255,255,0.13)',
        overlay: 'linear-gradient(180deg, rgba(10,8,10,0.30) 0%, rgba(10,8,10,0.78) 100%)'
      },
      sources
    }
  }

  // Referenz-Rolle „heller Hintergrund“ → hellster Kunden-Ton (z. B. Beige/Creme)
  let paper = mix(light, WHITE, 0.35)
  if (blend > 0) paper = mix(paper, { r: 250, g: 248, b: 244 }, blend)
  const surface = mix(WHITE, light, 0.12)
  let ink = ensureReadable(dark, paper, 7)
  let acc = accent
  if (lum(acc) > 0.72) acc = darken(acc, 0.28)
  if (lum(acc) < 0.15) acc = lighten(acc, 0.15)
  // CTA-Lesbarkeit: weißer Text braucht ausreichend dunklen Button
  let ctaGuard = 0
  while (lum(acc) > 0.52 && ctaGuard++ < 8) acc = darken(acc, 0.1)
  const cta = acc
  sources['--preview-bg'] = src('hellster Markenton (Beige/Creme)')
  sources['--preview-surface'] = src('hellster Markenton (Fläche)')
  sources['--preview-text'] = src('dunkelster Markenton, lesbar gemacht')
  sources['--preview-accent'] = sources['--preview-cta'] = src('Marken-Akzent')
  return {
    palette: {
      primary: toHex(accent),
      secondary: toHex(secondary),
      cta: toHex(cta),
      ctaHover: toHex(darken(cta, 0.16)),
      paper: toHex(paper),
      surface: toHex(surface),
      ink: toHex(ink),
      muted: toHex(mix(ink, paper, 0.45)),
      accent: toHex(acc),
      accentInk: lum(acc) > 0.62 ? '#1a1712' : '#ffffff',
      line: toHex(mix(paper, ink, 0.12)),
      overlay: 'linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.42))'
    },
    sources
  }
}

/** Referenz-/Neutral-Palette (Kunde A höchstens als Akzent-Beimischung). */
function referencePalette(profile: StyleProfile, brand: BrandProfile, insp: InspirationReference, strength: number): { palette: PreviewPalette; sources: Record<string, string> } {
  const refAcc = referenceAccent(insp)
  const brandAcc = parseHex(brand.accent) || refAcc
  const brandPrimary = parseHex(brand.primary) || brandAcc
  const dark = profile.backgroundStyle === 'dark'
  let accent = mix(refAcc, brandAcc, strength)
  if (dark && lum(accent) < 0.42) accent = lighten(accent, 0.3)
  if (!dark && lum(accent) > 0.82) accent = darken(accent, 0.2)
  const cta = accent
  const accentSrc = strength >= 0.4 ? 'Mischung Referenz+Kunde' : 'Referenz B'
  const sources: Record<string, string> = {
    '--preview-bg': dark ? 'neutral dunkel (Referenz-Rolle)' : 'neutral hell (Referenz-Rolle)',
    '--preview-text': 'neutral (lesbar)',
    '--preview-accent': accentSrc,
    '--preview-cta': accentSrc
  }
  const palette: PreviewPalette = dark
    ? {
        primary: toHex(lighten(brandPrimary, 0.15)),
        secondary: toHex(parseHex(brand.secondary) || brandPrimary),
        cta: toHex(cta),
        ctaHover: toHex(lighten(cta, 0.12)),
        paper: '#141015',
        surface: '#1c171d',
        ink: '#f3ece1',
        muted: '#b3a899',
        accent: toHex(accent),
        accentInk: lum(accent) > 0.62 ? '#1a1712' : '#ffffff',
        line: 'rgba(255,255,255,0.12)',
        overlay: 'linear-gradient(180deg, rgba(15,11,16,0.30) 0%, rgba(15,11,16,0.80) 100%)'
      }
    : {
        primary: toHex(brandPrimary),
        secondary: toHex(parseHex(brand.secondary) || brandPrimary),
        cta: toHex(cta),
        ctaHover: toHex(darken(cta, 0.16)),
        paper: profile.backgroundStyle === 'cream' ? '#faf6ef' : '#faf8f4',
        surface: '#ffffff',
        ink: '#211c16',
        muted: '#7c7367',
        accent: toHex(accent),
        accentInk: lum(accent) > 0.62 ? '#1a1712' : '#ffffff',
        line: profile.backgroundStyle === 'cream' ? '#e9e0d3' : '#e7e2d9',
        overlay: 'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.35))'
      }
  return { palette, sources }
}

/**
 * Bildet die Marke von A auf die Rollenstruktur von B ab.
 * REGEL: Finale Farbwerte kommen IMMER von Kunde A (B liefert nur Rollen wie „dunkle Nav“,
 * „helle Fläche“, „Akzent“). Neutrale Fallback-Palette nur, wenn A gar keine Farben liefert.
 */
export function mapColors(profile: StyleProfile, brand: BrandProfile, insp: InspirationReference, controls?: StyleControls): MappingResult {
  // Gesperrte/bestätigte Palette → exakt übernehmen (kein Überschreiben bei Regenerierung)
  if (controls?.paletteLocked && controls.lockedPalette) {
    return { palette: controls.lockedPalette, brandStrength: 100, mode: 'customer-only', winner: 'gesperrte Palette', sources: { alle: 'gesperrte/bestätigte Palette' } }
  }

  if (brand.source === 'default') {
    // Keine Kundenfarben auffindbar → neutrale Premium-Palette (klar gekennzeichnet)
    const out = referencePalette(profile, brand, insp, 0)
    const sources = Object.fromEntries(Object.keys(out.sources).map((k) => [k, 'Fallback: keine Kundenfarben gefunden']))
    return { palette: out.palette, brandStrength: 0, mode: 'customer-only', winner: 'Fallback (keine Kundenfarben gefunden)', sources }
  }

  const out = customerPalette(profile, brand, 0.12)
  return { palette: out.palette, brandStrength: 100, mode: 'customer-only', winner: `Kundenpalette (${brand.source})`, sources: out.sources }
}
