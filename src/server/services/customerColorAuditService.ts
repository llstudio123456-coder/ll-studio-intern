import type { DetectedColor, RejectedColor, PaletteAuditResult, ColorSource, ColorRole } from '@shared/types'
import { BrowserManager } from './browser'
import { parseHex, lum, sat, isNeutral, type RGB } from './colorUtils'
import { log } from '../utils/logger'

/* ────────────────────────── In-Page-Extraktion (mit Fläche + Selektor) ────────────────────────── */

interface RawObs {
  hex: string
  source: string
  area: number
  selector: string
}

/* eslint-disable */
function pageScript() {
  const out: { hex: string; source: string; area: number; selector: string }[] = []
  let cookieFound = false
  const cookieRe = /cookie|consent|usercentrics|cmplz|borlabs|gdpr|cmp-|didomi|onetrust/i
  const widgetRe = /maps|gm-style|fb-|facebook|instagram|twitter|tiktok|youtube|widget|chat|tawk|intercom|crisp|elfsight|shariff/i

  const rgbToHex = (v: string): string | null => {
    if (!v) return null
    const m = v.match(/rgba?\(([^)]+)\)/)
    if (!m) {
      const hx = v.trim().match(/^#([0-9a-f]{6})$/i)
      if (hx) return '#' + hx[1].toLowerCase()
      const h3 = v.trim().match(/^#([0-9a-f]{3})$/i)
      if (h3) return '#' + h3[1].split('').map((c) => c + c).join('').toLowerCase()
      return null
    }
    const p = m[1].split(',').map((x) => parseFloat(x.trim()))
    if (p[3] !== undefined && p[3] < 0.5) return null
    const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
    return '#' + h(p[0]) + h(p[1]) + h(p[2])
  }
  const selOf = (el: Element): string => {
    const id = (el as HTMLElement).id ? '#' + (el as HTMLElement).id : ''
    const cls = typeof (el as HTMLElement).className === 'string' ? '.' + (el as HTMLElement).className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''
    return (el.tagName.toLowerCase() + id + cls).slice(0, 60)
  }
  const ancestorClass = (el: Element | null, re: RegExp): boolean => {
    let n: Element | null = el
    let d = 0
    while (n && d < 9) {
      const s = (n.id || '') + ' ' + (typeof (n as HTMLElement).className === 'string' ? (n as HTMLElement).className : '')
      if (re.test(s)) return true
      n = n.parentElement
      d++
    }
    return false
  }
  const push = (hex: string | null, source: string, el: Element | null, areaOverride?: number) => {
    if (!hex) return
    let src = source
    if (el) {
      if (ancestorClass(el, cookieRe)) { src = 'cookie-banner'; cookieFound = true }
      else if (el.closest('iframe') || ancestorClass(el, widgetRe)) src = 'third-party-widget'
    }
    let area = areaOverride ?? 0
    if (el && areaOverride === undefined) {
      const r = (el as HTMLElement).getBoundingClientRect()
      area = Math.max(0, Math.round(r.width * r.height))
      if (area === 0) return // unsichtbar
    }
    out.push({ hex, source: src, area, selector: el ? selOf(el) : source })
  }

  // 1) CSS-Variablen (alle Stylesheets + :root), markenverdächtige Namen bevorzugt
  const brandVar = /(primary|secondary|accent|brand|theme|main|cta|button|link|highlight|akzent|haupt|blue|blau|green|grün|red|rot|gold|beige|cream|navy|dark|light)/i
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | null = null
      try { rules = (sheet as CSSStyleSheet).cssRules } catch { continue }
      if (!rules) continue
      for (const rule of Array.from(rules)) {
        const style = (rule as CSSStyleRule).style
        if (!style) continue
        for (let i = 0; i < style.length; i++) {
          const prop = style[i]
          if (prop.startsWith('--') && brandVar.test(prop)) {
            push(rgbToHex(style.getPropertyValue(prop).trim()), 'css-var', null, 50000)
          }
        }
      }
    }
    const cs = getComputedStyle(document.documentElement)
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i]
      if (prop.startsWith('--') && brandVar.test(prop)) push(rgbToHex(cs.getPropertyValue(prop).trim()), 'css-var', null, 50000)
    }
  } catch {}

  // 2) Header / Nav (Hintergrund + Linkfarben)
  const header = document.querySelector('header, [class*="header"], [id*="header"]') as HTMLElement | null
  if (header) {
    push(rgbToHex(getComputedStyle(header).backgroundColor), 'header', header)
    for (const a of Array.from(header.querySelectorAll('a')).slice(0, 15)) push(rgbToHex(getComputedStyle(a).color), 'nav', a)
  }
  const nav = document.querySelector('nav, [role="navigation"]') as HTMLElement | null
  if (nav && nav !== header) {
    push(rgbToHex(getComputedStyle(nav).backgroundColor), 'nav', nav)
    for (const a of Array.from(nav.querySelectorAll('a')).slice(0, 15)) push(rgbToHex(getComputedStyle(a).color), 'nav', a)
  }

  // 3) Logo-Bereich: SVG fills/strokes + Umfeld
  const logoRoot = document.querySelector('header [class*="logo"], [class*="logo"], header svg, a[href="/"] svg') as HTMLElement | null
  if (logoRoot) {
    const svgEls = logoRoot.matches('svg') ? [logoRoot] : Array.from(logoRoot.querySelectorAll('svg'))
    for (const svg of svgEls.slice(0, 2)) {
      for (const p of Array.from(svg.querySelectorAll('path, rect, circle, polygon, text')).slice(0, 30)) {
        const cs = getComputedStyle(p as Element)
        push(rgbToHex(cs.fill), 'logo', svg as Element)
        push(rgbToHex(cs.stroke), 'logo', svg as Element)
      }
    }
  }

  // 4) Buttons / CTAs
  for (const b of Array.from(document.querySelectorAll('button, [class*="btn"], [class*="button"], input[type="submit"], a[class*="cta"], a[class*="book"], a[class*="reserv"]')).slice(0, 30)) {
    const cs = getComputedStyle(b as Element)
    push(rgbToHex(cs.backgroundColor), 'button', b)
    push(rgbToHex(cs.color), 'cta', b)
    push(rgbToHex(cs.borderColor), 'border', b)
  }

  // 5) Links im Inhalt
  for (const a of Array.from(document.querySelectorAll('main a, section a, article a')).slice(0, 25)) {
    push(rgbToHex(getComputedStyle(a).color), 'link', a)
  }

  // 6) Footer
  const footer = document.querySelector('footer, [class*="footer"]') as HTMLElement | null
  if (footer) {
    push(rgbToHex(getComputedStyle(footer).backgroundColor), 'footer', footer)
    for (const a of Array.from(footer.querySelectorAll('a')).slice(0, 8)) push(rgbToHex(getComputedStyle(a).color), 'footer', a)
  }

  // 7) Große Sektions-Hintergründe (echte UI-Flächen, keine Fotos)
  const vw = window.innerWidth
  for (const s of Array.from(document.querySelectorAll('section, main > div, body > div')).slice(0, 60)) {
    const r = (s as HTMLElement).getBoundingClientRect()
    if (r.width < vw * 0.6 || r.height < 120) continue
    const cs = getComputedStyle(s as Element)
    if (cs.backgroundImage && cs.backgroundImage.includes('url(')) continue // Foto-Fläche
    push(rgbToHex(cs.backgroundColor), 'section-bg', s)
  }
  push(rgbToHex(getComputedStyle(document.body).backgroundColor), 'section-bg', document.body)

  // 8) Fließtext-Farbe
  const p = document.querySelector('main p, section p, p') as HTMLElement | null
  if (p) push(rgbToHex(getComputedStyle(p).color), 'text', p)

  // interne Links für Crawl
  const internal: string[] = []
  const want = /(speisekarte|karte|menu|angebot|leistung|restaurant|über|ueber|about|kontakt|galerie|weine?)/i
  for (const a of Array.from(document.querySelectorAll('nav a, header a')).slice(0, 40)) {
    const href = (a as HTMLAnchorElement).href
    try {
      const u = new URL(href)
      if (u.hostname === location.hostname && want.test(u.pathname + (a as HTMLElement).innerText)) internal.push(u.toString())
    } catch {}
  }

  return { obs: out, cookieFound, internal: Array.from(new Set(internal)).slice(0, 4) }
}
/* eslint-enable */

/* ────────────────────────── Aggregation & Bewertung (beweisbasiert) ────────────────────────── */

const SOURCE_RANK: ColorSource[] = ['manual', 'logo', 'css-var', 'cta', 'button', 'nav', 'header', 'footer', 'section-bg', 'link', 'border', 'text', 'background', 'screenshot', 'image', 'third-party-widget', 'cookie-banner', 'unknown']
const SOURCE_BASE: Partial<Record<ColorSource, number>> = {
  logo: 92, 'css-var': 90, cta: 84, button: 84, nav: 82, header: 78, footer: 66, 'section-bg': 64, link: 60, border: 50, text: 45, background: 45, screenshot: 25, image: 12, 'third-party-widget': 10, 'cookie-banner': 10
}

interface Agg {
  hex: string
  source: ColorSource
  sources: Set<ColorSource>
  count: number
  area: number
  pages: number
  selector: string
}

function keyOf(c: RGB): string {
  return `${Math.round(c.r / 14)},${Math.round(c.g / 14)},${Math.round(c.b / 14)}`
}

function scoreAgg(a: Agg, logs: string[]): { confidence: number; include: boolean; reason: string } {
  const c = parseHex(a.hex)
  if (!c) return { confidence: 0, include: false, reason: 'ungültig' }
  const L = lum(c)
  const S = sat(c)
  const reasons: string[] = [a.source]
  let conf = SOURCE_BASE[a.source] ?? 40

  // schlechte Quellen sofort raus
  if (a.source === 'cookie-banner') return { confidence: 10, include: false, reason: 'Cookie-Banner (verworfen)' }
  if (a.source === 'third-party-widget') return { confidence: 10, include: false, reason: 'Dritt-Widget (verworfen)' }
  if (a.source === 'image' || a.source === 'screenshot') return { confidence: 20, include: false, reason: 'nur Foto/Screenshot (nur Stützindiz)' }

  // Beweis-Boni: mehrere Seiten, mehrere Quellen, große Fläche, viele Vorkommen
  if (a.pages >= 2) { conf += 8; reasons.push(`${a.pages} Seiten`) }
  if (a.sources.size >= 3) { conf += 8; reasons.push(`${a.sources.size} UI-Bereiche`) }
  else if (a.sources.size === 2) conf += 4
  if (a.area >= 200000) { conf += 10; reasons.push('große Fläche') }
  else if (a.area >= 40000) conf += 5
  if (a.count >= 6) conf += 6
  else if (a.count >= 3) conf += 3

  // Weiß/Schwarz/Grau: nur als Neutral-Rollen, nie „Marke“
  const pureWhite = L > 0.95 && S < 0.1
  const pureBlack = L < 0.08 && S < 0.3
  const darkInBrandArea = ['header', 'nav', 'footer', 'logo'].some((s) => a.sources.has(s as ColorSource))
  if (pureWhite) { conf = Math.min(conf, 46); reasons.push('reines Weiß (nur Hintergrund-Rolle)') }
  else if (pureBlack) {
    conf = Math.min(conf, darkInBrandArea ? 74 : 55)
    reasons.push(darkInBrandArea ? 'Schwarz in Markenbereich (Neutral-Rolle ok)' : 'reines Schwarz')
  } else if (isNeutral(c) && L > 0.15 && L < 0.9) { conf -= 22; reasons.push('grau/neutral') }

  // Browser-Default-Blau (#0000ee-artig) ist praktisch NIE Marke – auch in Nav (ungestylte Links)
  const isDefaultLinkBlue = c.b > 180 && c.r < 90 && c.g < 90
  if (isDefaultLinkBlue && !(a.sources.has('css-var') && a.area > 100000)) {
    conf = Math.min(conf - 40, 50)
    reasons.push('Browser-Default-Blau (ungestylte Links)')
  }

  // Vereinzelte kleine bunte Elemente (z. B. ein rotes Icon) sind KEINE Marke
  if (S > 0.25 && a.pages <= 1 && a.area < 15000 && a.count < 3 && !a.sources.has('css-var') && !a.sources.has('logo')) {
    conf -= 22
    reasons.push('vereinzeltes kleines Element')
  }
  // Nur als CSS-Variable definiert, aber nirgends sichtbar im UI benutzt → nie auto-übernehmen
  if (a.sources.size === 1 && a.source === 'css-var') {
    conf = Math.min(conf - 10, 65)
    reasons.push('nur definiert, nicht sichtbar genutzt')
  }

  conf = Math.max(0, Math.min(100, Math.round(conf)))
  const include = conf >= 70
  const reason = reasons.join(', ')
  logs.push(`${a.hex} ${conf}${include ? '✓' : '✗'} [${[...a.sources].join('+')}] Fläche ${Math.round(a.area / 1000)}k · ${a.count}× · ${a.pages}S – ${reason}`)
  return { confidence: conf, include, reason }
}

/** Rollen-Zuordnung aus belegten Kandidaten. */
function assignAuditRoles(cands: DetectedColor[]): Partial<Record<ColorRole, string>> {
  const roles: Partial<Record<ColorRole, string>> = {}
  const inc = cands.filter((d) => d.include)
  const rgb = (d: DetectedColor) => parseHex(d.hex)!
  const chrom = inc.filter((d) => sat(rgb(d)) > 0.12 && !isNeutral(rgb(d))).sort((a, b) => b.confidence - a.confidence)
  // Hintergrund/Text sind NEUTRAL-Rollen – dürfen auch aus nicht-inkludierten Kandidaten kommen
  // (Weiß/Hellgrau als Fläche ist legitim, nur eben keine „Marke“)
  const lightNeutral = cands.filter((d) => lum(rgb(d)) > 0.82).sort((a, b) => (b.area || 0) - (a.area || 0))
  const darkTone = [...cands].filter((d) => lum(rgb(d)) < 0.35).sort((a, b) => b.confidence - a.confidence)

  if (chrom[0]) roles.primary = chrom[0].hex
  else if (darkTone[0]) roles.primary = darkTone[0].hex // dunkle Marken (schwarz/navy) sind legitim
  if (chrom[1]) roles.secondary = chrom[1].hex
  const btn = inc.find((d) => (d.source === 'button' || d.source === 'cta') && sat(rgb(d)) > 0.1)
  roles.cta = btn?.hex || chrom[0]?.hex || roles.primary
  roles.accent = chrom[0]?.hex || roles.cta
  if (lightNeutral[0]) roles.background = lightNeutral[0].hex
  if (lightNeutral[1]) roles.surface = lightNeutral[1].hex
  const text = inc.find((d) => d.source === 'text') || darkTone[0]
  if (text) roles.text = text.hex

  // Rollen zurück auf Kandidaten spiegeln
  const roleFor = (hex: string): ColorRole | undefined => (Object.entries(roles).find(([, h]) => h === hex)?.[0] as ColorRole | undefined)
  for (const d of cands) {
    const r = roleFor(d.hex)
    if (r) d.role = r
  }
  return roles
}

/* ────────────────────────── Haupt-Audit ────────────────────────── */

/**
 * Zuverlässige Farbanalyse von Kunde A: crawlt Startseite + bis zu 2 Unterseiten,
 * extrahiert Farben aus CSS-Variablen + computed UI-Styles (mit Fläche/Selektor),
 * filtert Cookie/Widget/Foto-Quellen und belegt jede Entscheidung.
 */
export async function auditCustomerColors(bm: BrowserManager, url: string): Promise<PaletteAuditResult> {
  const logs: string[] = []
  const pagesCrawled: string[] = []
  const buckets = new Map<string, Agg>()
  let cookieFiltered = false

  const crawl = async (pageUrl: string) => {
    let page
    try {
      page = await bm.newPage()
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(1300)
      const raw = (await page.evaluate(pageScript)) as { obs: RawObs[]; cookieFound: boolean; internal: string[] }
      pagesCrawled.push(pageUrl)
      if (raw.cookieFound) cookieFiltered = true
      const seenThisPage = new Set<string>()
      for (const o of raw.obs) {
        const c = parseHex(o.hex)
        if (!c) continue
        const key = keyOf(c)
        const src = o.source as ColorSource
        let agg = buckets.get(key)
        if (!agg) {
          agg = { hex: o.hex.toLowerCase(), source: src, sources: new Set([src]), count: 0, area: 0, pages: 0, selector: o.selector }
          buckets.set(key, agg)
        }
        agg.count++
        agg.area += o.area
        agg.sources.add(src)
        if (SOURCE_RANK.indexOf(src) < SOURCE_RANK.indexOf(agg.source)) {
          agg.source = src
          agg.selector = o.selector
        }
        if (!seenThisPage.has(key)) {
          agg.pages++
          seenThisPage.add(key)
        }
      }
      return raw.internal
    } catch (e) {
      logs.push(`Seite fehlgeschlagen: ${pageUrl} (${e instanceof Error ? e.message : e})`)
      return []
    } finally {
      try { await page?.close() } catch {}
    }
  }

  const internal = await crawl(url)
  for (const sub of internal.slice(0, 2)) await crawl(sub)
  logs.push(`Gecrawlt: ${pagesCrawled.length} Seite(n)`)

  const candidates: DetectedColor[] = []
  const rejected: RejectedColor[] = []
  for (const agg of buckets.values()) {
    const s = scoreAgg(agg, logs)
    const det: DetectedColor = {
      hex: agg.hex,
      source: agg.source,
      confidence: s.confidence,
      role: 'muted',
      count: agg.count,
      area: agg.area,
      pages: agg.pages,
      selector: agg.selector,
      include: s.include,
      reason: s.reason
    }
    if (agg.source === 'cookie-banner' || agg.source === 'third-party-widget' || agg.source === 'image') {
      rejected.push({ hex: agg.hex, source: agg.source, reason: s.reason })
    } else if (!s.include && s.confidence < 45) {
      rejected.push({ hex: agg.hex, source: agg.source, reason: s.reason })
    } else {
      candidates.push(det)
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence)
  const top = candidates.slice(0, 14)

  const roles = assignAuditRoles(top)
  const primaryConf = top.find((d) => d.hex === roles.primary)?.confidence ?? 0
  const overallConfidence = Math.round(primaryConf * 0.7 + (top.filter((d) => d.include).length >= 3 ? 30 : 15))

  logs.push(`Rollen: ${Object.entries(roles).map(([r, h]) => `${r}=${h}`).join(' · ')}`)
  logs.push(`Gesamt-Vertrauen: ${overallConfidence}`)
  log.info(`Farb-Audit ${url}:\n  ` + logs.join('\n  '))

  return { url, pagesCrawled, candidates: top, rejected, roles, overallConfidence: Math.min(100, overallConfidence), cookieFiltered, logs }
}
