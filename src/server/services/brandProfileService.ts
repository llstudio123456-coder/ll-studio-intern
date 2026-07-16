import type { SourceCompany, StyleControls, BrandProfile } from '@shared/types'
import { parseHex, toHex, lum, sat, lighten, darken, isNeutral, isGenericBlue, type RGB } from './colorUtils'

function dedupe(hexes: string[]): RGB[] {
  const out: RGB[] = []
  for (const h of hexes) {
    const c = parseHex(h)
    if (!c) continue
    if (out.some((o) => Math.abs(o.r - c.r) + Math.abs(o.g - c.g) + Math.abs(o.b - c.b) < 28)) continue
    out.push(c)
  }
  return out
}

/**
 * Baut das Markenprofil von Kunde A.
 * Priorität: manuelle UI-Farben > manuell eingegebene HEX > Logo-Farben > Website-Farben.
 */
export function buildBrandProfile(source: SourceCompany, controls?: StyleControls): BrandProfile {
  const manual = source.colors || []
  const logo = source.logoColors || []
  const web = source.websiteColors || []
  const notes: string[] = []

  // Quelle für den „Gewinner“ bestimmen
  let source_: BrandProfile['source'] = 'default'
  if (controls?.primaryColor || controls?.accentColor || controls?.secondaryColor) source_ = 'manual'
  else if (manual.length) source_ = 'manual'
  else if (logo.length) source_ = 'logo'
  else if (web.length) source_ = 'website'
  const usedLists = [manual.length && 'manuell', logo.length && 'Logo', web.length && 'Website'].filter(Boolean)
  if (usedLists.length > 1) source_ = 'mixed'

  const pool = dedupe([
    ...(controls?.primaryColor ? [controls.primaryColor] : []),
    ...(controls?.secondaryColor ? [controls.secondaryColor] : []),
    ...(controls?.accentColor ? [controls.accentColor] : []),
    ...manual,
    ...logo,
    ...web
  ])

  // Markenfarben in PRIORITÄTS-Reihenfolge (manuell>logo>website; Website ist bereits
  // beweisbasiert nach Confidence/Rolle sortiert – kein Farbton-Vorurteil hier).
  const brandish = pool.filter((c) => !isNeutral(c) && lum(c) > 0.1 && lum(c) < 0.95)
  // dunkelster Ton bevorzugt aus NICHT-generisch-blauen Farben (Template-Blau darf nicht Textfarbe werden)
  const nonBlue = pool.filter((c) => !isGenericBlue(c))
  const darkest = [...(nonBlue.length ? nonBlue : pool)].sort((a, b) => lum(a) - lum(b))[0]
  const lightest = [...(nonBlue.length ? nonBlue : pool)].sort((a, b) => lum(b) - lum(a))[0]
  const saturated = brandish

  const def: RGB = { r: 176, g: 141, b: 87 } // warmes Gold als letzter Fallback
  const primary = parseHex(controls?.primaryColor) || brandish[0] || darkest || def
  const accent = parseHex(controls?.accentColor) || brandish[0] || primary
  const secondary = parseHex(controls?.secondaryColor) || brandish[1] || (isNeutral(primary) ? lighten(primary, 0.4) : darken(primary, 0.2))

  if (!saturated.length && pool.length) notes.push('Marke wirkt neutral (schwarz/beige) – Palette bleibt dezent.')
  if (!pool.length) notes.push('Keine Marken-Farben gefunden – neutrale Premium-Palette.')
  if (logo.length) notes.push(`Logo-Farben erkannt: ${logo.slice(0, 3).join(', ')}`)
  if (manual.length) notes.push(`Manuelle Farben: ${manual.slice(0, 3).join(', ')}`)

  return {
    primary: toHex(primary),
    secondary: toHex(secondary),
    accent: toHex(accent),
    neutralDark: toHex(darkest || { r: 26, g: 23, b: 26 }),
    neutralLight: toHex(lightest || { r: 250, g: 247, b: 241 }),
    text: lum(primary) < 0.5 ? '#1c1a17' : '#f4efe7',
    button: toHex(accent),
    hover: toHex(darken(accent, 0.16)),
    border: '#e7e2d9',
    source: source_,
    sourceNotes: notes
  }
}
