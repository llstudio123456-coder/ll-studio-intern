import type { DetectedColor, ColorRole } from '@shared/types'
import { parseHex, lum, sat, isNeutral, isBeige, isGenericBlue, type RGB } from './colorUtils'

function roleFor(c: RGB, rank: number): ColorRole {
  const L = lum(c)
  const S = sat(c)
  if (isNeutral(c) && L > 0.85) return 'background'
  if (isBeige(c)) return 'surface'
  if (isNeutral(c) && L < 0.22) return 'text'
  if (isNeutral(c)) return 'muted'
  // Markenfarben (auch leicht entsättigtes Grün/Sage) nach Rang
  if (S > 0.12) return rank === 0 ? 'primary' : rank === 1 ? 'secondary' : 'accent'
  return 'muted'
}

/** Weist erkannten Farben sinnvolle Rollen zu (primary/secondary/accent/background/text/…). */
export function assignRoles(colors: DetectedColor[]): DetectedColor[] {
  // Markenfarben nach Confidence – KEIN Farbton-Vorurteil mehr: die beweisbasierte
  // Bewertung (Quelle/Fläche/Seiten) entscheidet. Ein echtes Marken-Blau darf gewinnen.
  const brandRanked = colors
    .map((d) => ({ d, c: parseHex(d.hex) }))
    .filter((x): x is { d: DetectedColor; c: RGB } => !!x.c && sat(x.c) > 0.12 && !isNeutral(x.c))
    .sort((a, b) => b.d.confidence - a.d.confidence)

  const rankOf = new Map<string, number>()
  brandRanked.forEach((x, i) => rankOf.set(x.d.hex, i))

  return colors.map((d) => {
    const c = parseHex(d.hex)
    if (!c) return d
    return { ...d, role: roleFor(c, rankOf.get(d.hex) ?? 9) }
  })
}

/** Liefert die für das Markenprofil nutzbaren Hex-Werte (eingeschlossen, nach Rolle/Confidence). */
export function selectBrandHexes(colors: DetectedColor[]): string[] {
  const order: ColorRole[] = ['primary', 'secondary', 'accent', 'surface', 'background', 'muted', 'text']
  return colors
    .filter((d) => d.include)
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || b.confidence - a.confidence)
    .map((d) => d.hex)
}
