export type RGB = { r: number; g: number; b: number }

export function parseHex(hex?: string): RGB | null {
  if (!hex) return null
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
export const toHex = ({ r, g, b }: RGB) =>
  `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`
export const lum = ({ r, g, b }: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
export const sat = ({ r, g, b }: RGB) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}
export const mix = (a: RGB, b: RGB, t: number): RGB => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t })
export const WHITE: RGB = { r: 255, g: 255, b: 255 }
export const BLACK: RGB = { r: 26, g: 23, b: 18 }
export const lighten = (c: RGB, t: number) => mix(c, WHITE, t)
export const darken = (c: RGB, t: number) => mix(c, BLACK, t)
export const isNeutral = (c: RGB) => sat(c) < 0.12
/** relativer Luminanz-Kontrast 1..21 */
export function contrast(a: RGB, b: RGB): number {
  const L = (c: RGB) => {
    const f = (v: number) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const la = L(a)
  const lb = L(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
/** Macht `fg` lesbar gegen `bg` (hellt auf / dunkelt ab, bis Kontrast >= min). */
export function ensureReadable(fg: RGB, bg: RGB, min = 3.2): RGB {
  let c = fg
  let i = 0
  const towardLight = lum(bg) < 0.5
  while (contrast(c, bg) < min && i < 12) {
    c = towardLight ? lighten(c, 0.12) : darken(c, 0.12)
    i++
  }
  return c
}
export const hexLum = (hex: string) => {
  const c = parseHex(hex)
  return c ? lum(c) : null
}
/** Farbton 0..360 */
export function hue({ r, g, b }: RGB): number {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  if (d === 0) return 0
  let h = 0
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}
/** „beige/creme“: warm, hell, leicht gesättigt */
export function isBeige(c: RGB): boolean {
  const h = hue(c)
  return lum(c) > 0.62 && lum(c) < 0.96 && sat(c) >= 0.08 && sat(c) <= 0.45 && (h <= 60 || h >= 330)
}
/** browser-typisches Default-/Link-Blau (z. B. #0000ee) */
export function isDefaultBlue(c: RGB): boolean {
  const h = hue(c)
  return h >= 205 && h <= 250 && sat(c) > 0.55 && lum(c) > 0.05 && lum(c) < 0.62
}
/** allgemein „blau/violett“ – häufige Framework-/Link-Default-Farbe, selten echte Marke */
export function isGenericBlue(c: RGB): boolean {
  const h = hue(c)
  return h >= 200 && h <= 260 && sat(c) > 0.4
}
