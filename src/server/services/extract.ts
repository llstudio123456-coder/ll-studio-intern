import { join } from 'path'
import { type Page } from 'playwright'
import type {
  WebsiteSnapshot,
  ColorInfo,
  DetectedPage,
  WebsiteFeatures,
  DesignStyle,
  Tonality
} from '@shared/types'
import { BrowserManager, looksBlocked } from './browser'
import { detectIndustry } from './industry'
import { getDomain } from '../utils/url'
import { screenshotsDir } from '../utils/paths'
import { log } from '../utils/logger'

/** Rohdaten, die direkt im Browser-Kontext gesammelt werden. */
interface RawExtract {
  title: string
  metaDescription: string
  ogSiteName: string
  schemaOrgName: string
  schemaAddress: string
  themeColor: string
  h1: string[]
  headings: string[]
  navLinks: { label: string; href: string }[]
  visibleText: string
  bodyHtmlLen: number
  domNodes: number
  imageCount: number
  largeImageCount: number
  hasViewportMeta: boolean
  hasFavicon: boolean
  colors: { color: string; bg: string }[]
  fonts: string[]
  rawHtml: string
  heroText: string
  addressGuess: string
}

/* eslint-disable */
function pageScript() {
  const txt = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
  const pick = (sel: string) =>
    Array.from(document.querySelectorAll(sel))
      .map((e) => (e as HTMLElement).innerText?.trim())
      .filter(Boolean) as string[]

  const meta = (name: string) =>
    (document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement)?.content ||
    (document.querySelector(`meta[property="${name}"]`) as HTMLMetaElement)?.content ||
    ''

  // schema.org Organization / LocalBusiness
  let schemaOrgName = ''
  let schemaAddress = ''
  try {
    const blocks = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    for (const b of blocks) {
      const data = JSON.parse((b as HTMLScriptElement).innerText)
      const arr = Array.isArray(data) ? data : [data]
      for (const node of arr) {
        const n = node && node['@graph'] ? node['@graph'] : [node]
        for (const item of Array.isArray(n) ? n : [n]) {
          if (item && item.name && !schemaOrgName) schemaOrgName = String(item.name)
          if (item && item.address) {
            const a = item.address
            schemaAddress = typeof a === 'string'
              ? a
              : [a.streetAddress, a.postalCode, a.addressLocality].filter(Boolean).join(' ')
          }
        }
      }
    }
  } catch (e) {}

  // Farben aus repräsentativen Elementen sammeln
  const sampleSel = ['body', 'header', 'nav', 'h1', 'h2', 'a', 'button', '.btn', 'footer', 'section']
  const colors: { color: string; bg: string }[] = []
  for (const sel of sampleSel) {
    const els = Array.from(document.querySelectorAll(sel)).slice(0, 6)
    for (const el of els) {
      const cs = getComputedStyle(el as Element)
      colors.push({ color: cs.color, bg: cs.backgroundColor })
    }
  }

  // Fonts
  const fonts = new Set<string>()
  for (const sel of ['body', 'h1', 'h2', 'button']) {
    const el = document.querySelector(sel)
    if (el) fonts.add(getComputedStyle(el).fontFamily)
  }

  // Navigation / Unterseiten
  const navAnchors = Array.from(
    document.querySelectorAll('header a, nav a, [role="navigation"] a')
  ).slice(0, 40) as HTMLAnchorElement[]
  const navLinks = navAnchors
    .map((a) => ({ label: (a.innerText || '').trim(), href: a.href }))
    .filter((l) => l.label && l.href && !l.href.startsWith('javascript'))

  // Adresse grob per Regex (PLZ + Ort)
  let addressGuess = ''
  const m = txt.match(/\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß.\- ]{2,40})/)
  if (m) addressGuess = m[0]

  const imgs = Array.from(document.images)
  const largeImageCount = imgs.filter((i) => (i.naturalWidth || 0) * (i.naturalHeight || 0) > 400000).length

  // Hero-Text: größte sichtbare Überschrift im oberen Bereich
  let heroText = ''
  const h1el = document.querySelector('h1') as HTMLElement | null
  if (h1el) heroText = (h1el.innerText || '').trim()

  return {
    title: document.title || '',
    metaDescription: meta('description'),
    ogSiteName: meta('og:site_name'),
    schemaOrgName,
    schemaAddress,
    themeColor: meta('theme-color'),
    h1: pick('h1').slice(0, 5),
    headings: pick('h1, h2, h3').slice(0, 25),
    navLinks,
    visibleText: txt.slice(0, 8000),
    bodyHtmlLen: document.body?.innerHTML?.length || 0,
    domNodes: document.querySelectorAll('*').length,
    imageCount: imgs.length,
    largeImageCount,
    hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
    hasFavicon: !!document.querySelector('link[rel*="icon"]'),
    colors,
    fonts: Array.from(fonts),
    rawHtml: (document.documentElement.outerHTML || '').slice(0, 200000),
    heroText,
    addressGuess
  }
}
/* eslint-enable */

function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const parts = m[1].split(',').map((p) => parseFloat(p.trim()))
  const [r, g, b, a] = parts
  if (a !== undefined && a < 0.1) return null // transparent
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function distillColors(raw: { color: string; bg: string }[], themeColor: string): ColorInfo[] {
  const counts = new Map<string, number>()
  const add = (hex: string | null) => {
    if (!hex) return
    counts.set(hex, (counts.get(hex) || 0) + 1)
  }
  for (const c of raw) {
    add(rgbToHex(c.color))
    add(rgbToHex(c.bg))
  }
  const themeHex = themeColor && /^#?[0-9a-f]{6}$/i.test(themeColor.replace('#', ''))
    ? '#' + themeColor.replace('#', '')
    : null

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
  let list: ColorInfo[] = Array.from(counts.entries())
    .map(([hex, n]) => ({ hex, weight: Number((n / total).toFixed(2)) }))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))

  if (themeHex && !list.find((c) => c.hex.toLowerCase() === themeHex.toLowerCase())) {
    list.unshift({ hex: themeHex, role: 'accent', weight: 0.2 })
  }
  return list.slice(0, 8)
}

function classifyPages(navLinks: { label: string; href: string }[], baseUrl: string): DetectedPage[] {
  const seen = new Set<string>()
  const out: DetectedPage[] = []
  const map: [RegExp, DetectedPage['type']][] = [
    [/leistung|service|angebot|produkte|sortiment/i, 'services'],
    [/über|ueber|about|wir|unternehmen|philosoph|geschichte/i, 'about'],
    [/kontakt|contact|anfahrt|standort|impressum/i, 'contact'],
    [/galerie|gallery|projekte|referenz|portfolio|arbeiten/i, 'gallery'],
    [/bewertung|kundenstimmen|testimonial/i, 'references'],
    [/team|mitarbeiter|crew/i, 'team'],
    [/karriere|jobs|stellen|career/i, 'career'],
    [/blog|news|aktuelles|ratgeber/i, 'blog'],
    [/preis|pricing|tarif|kosten/i, 'pricing'],
    [/datenschutz|agb|impressum|widerruf/i, 'legal']
  ]
  for (const l of navLinks) {
    let host = ''
    try {
      host = new URL(l.href).hostname
    } catch {
      continue
    }
    if (host !== new URL(baseUrl).hostname) continue // nur interne Links
    const key = l.label.toLowerCase()
    if (seen.has(key) || !key) continue
    seen.add(key)
    let type: DetectedPage['type'] = 'other'
    for (const [re, t] of map) {
      if (re.test(l.label) || re.test(l.href)) {
        type = t
        break
      }
    }
    out.push({ label: l.label.slice(0, 40), url: l.href, type })
    if (out.length >= 20) break
  }
  return out
}

function detectFeatures(html: string, text: string): WebsiteFeatures {
  const h = (html + ' ' + text).toLowerCase()
  const has = (...keys: string[]) => keys.some((k) => h.includes(k))
  return {
    contactForm: has('<form', 'kontaktformular', 'nachricht senden', 'name="email"'),
    onlineBooking: has('termin buchen', 'online termin', 'calendly', 'terminvereinbarung', 'jetzt buchen', 'booking'),
    whatsapp: has('wa.me', 'whatsapp', 'api.whatsapp'),
    phoneClickToCall: has('href="tel:', 'tel:+'),
    reviews: has('google bewertung', 'sterne', 'rezension', 'kundenstimmen', 'testimonial', 'trustpilot', 'proven'),
    beforeAfter: has('vorher', 'nachher', 'before-after', 'vorher-nachher'),
    faq: has('faq', 'häufige fragen', 'haeufige fragen', 'fragen und antworten'),
    career: has('karriere', 'jobs', 'stellenangebot', 'wir stellen ein', 'bewirb'),
    gallery: has('galerie', 'gallery', 'lightbox', 'swiper', 'referenzen'),
    newsletter: has('newsletter', 'anmelden und', 'email abonnieren'),
    liveChat: has('livechat', 'tawk', 'intercom', 'crisp.chat', 'chat-widget'),
    multiLanguage: has('hreflang', '/en/', 'language-switch', 'lang-switch'),
    cookieBanner: has('cookie', 'consent', 'datenschutz-einstellungen', 'cookiebot', 'usercentrics')
  }
}

function inferTonality(text: string): Tonality {
  const t = text.toLowerCase()
  if (/exklusiv|premium|höchste qualität|manufaktur|tradition seit|meisterbetrieb/.test(t)) return 'premium'
  if (/günstig|angebot|jetzt sparen|aktion|rabatt|sale|%/.test(t)) return 'verkäuferisch'
  if (/wir freuen uns|herzlich willkommen|für sie da|persönlich/.test(t)) return 'freundlich'
  if (/technologie|effizienz|präzision|spezifikation|leistungsdaten/.test(t)) return 'technisch'
  if (/leidenschaft|liebe|herz|gefühl|genuss/.test(t)) return 'emotional'
  return 'sachlich'
}

function inferDesignStyle(
  colors: ColorInfo[],
  fonts: string[],
  largeImageCount: number,
  styleHint?: string
): DesignStyle {
  if (styleHint) {
    const s = styleHint.toLowerCase()
    const known: DesignStyle[] = ['modern', 'clean', 'premium', 'handwerklich', 'elegant', 'luxuriös', 'minimalistisch']
    const found = known.find((k) => s.includes(k))
    if (found) return found
  }
  const fontStr = fonts.join(' ').toLowerCase()
  const serif = /garamond|georgia|playfair|cormorant|times|serif/.test(fontStr) && !/sans-serif/.test(fontStr.replace('serif', ''))
  const distinct = colors.length
  if (serif && distinct <= 5) return 'elegant'
  if (distinct <= 3 && largeImageCount <= 2) return 'minimalistisch'
  if (distinct <= 4 && largeImageCount >= 2) return 'clean'
  if (distinct >= 7) return 'verspielt'
  return 'modern'
}

export interface AnalyzeOptions {
  styleHint?: string
  industryOverride?: string
  takeScreenshots?: boolean
  /** schnellere, leichtere Analyse (für viele Mitbewerber) */
  light?: boolean
}

/**
 * Besucht eine URL und baut einen vollständigen WebsiteSnapshot.
 * Wirft nie — Fehler werden im Snapshot (reachable/blocked/error) abgebildet.
 */
export async function analyzeWebsite(
  bm: BrowserManager,
  url: string,
  opts: AnalyzeOptions = {}
): Promise<WebsiteSnapshot> {
  const domain = getDomain(url)
  const base: WebsiteSnapshot = {
    url,
    finalUrl: url,
    domain,
    reachable: false,
    blocked: false,
    fetchedAt: new Date().toISOString(),
    services: [],
    tonality: 'unbekannt',
    designStyle: 'unbekannt',
    colors: [],
    pages: [],
    features: emptyFeatures(),
    metrics: { hasViewportMeta: false, httpsValid: url.startsWith('https://'), hasFavicon: false },
    headings: [],
    wordCount: 0
  }

  let page: Page | null = null
  try {
    page = await bm.newPage()
    const start = Date.now()
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1200) // kurze Zeit für Lazy-Content
    const loadMs = Date.now() - start
    base.finalUrl = page.url()
    base.reachable = true
    base.metrics.httpsValid = base.finalUrl.startsWith('https://')

    const raw = (await page.evaluate(pageScript)) as RawExtract

    if (looksBlocked(raw.rawHtml, base.finalUrl)) {
      base.blocked = true
      base.error = 'Seite zeigt Captcha / Blockierung'
    }

    // Firmenname bestimmen
    base.companyName =
      raw.schemaOrgName ||
      raw.ogSiteName ||
      raw.h1[0] ||
      raw.title.split(/[|\-–—:]/)[0].trim() ||
      domain
    base.title = raw.title
    base.metaDescription = raw.metaDescription
    base.headings = raw.headings
    base.heroText = raw.heroText || raw.h1[0]
    base.location = raw.schemaAddress || raw.addressGuess || undefined
    base.wordCount = raw.visibleText.split(/\s+/).filter(Boolean).length

    // Branche
    const corpus = `${raw.title} ${raw.headings.join(' ')} ${raw.visibleText} ${url}`
    if (opts.industryOverride) {
      base.industry = opts.industryOverride
      base.industryConfidence = 1
      base.services = detectIndustry(corpus).services
    } else {
      const det = detectIndustry(corpus)
      base.industry = det.industry
      base.industryConfidence = det.confidence
      base.services = det.services
    }

    base.colors = distillColors(raw.colors, raw.themeColor)
    base.pages = classifyPages(raw.navLinks, base.finalUrl)
    base.features = detectFeatures(raw.rawHtml, raw.visibleText)
    base.tonality = inferTonality(raw.visibleText)
    base.designStyle = inferDesignStyle(base.colors, raw.fonts, raw.largeImageCount, opts.styleHint)
    base.targetAudience = guessAudience(corpus)

    base.metrics = {
      loadMs,
      domNodes: raw.domNodes,
      imageCount: raw.imageCount,
      largeImageCount: raw.largeImageCount,
      hasViewportMeta: raw.hasViewportMeta,
      httpsValid: base.finalUrl.startsWith('https://'),
      hasFavicon: raw.hasFavicon,
      textToHtmlRatio: raw.bodyHtmlLen ? Number((raw.visibleText.length / raw.bodyHtmlLen).toFixed(3)) : undefined
    }

    if (opts.takeScreenshots !== false) {
      const safe = domain.replace(/[^a-z0-9.\-]/gi, '_')
      const stamp = Date.now()
      try {
        const dPath = join(screenshotsDir(), `${safe}_${stamp}_desktop.png`)
        await page.screenshot({ path: dPath, fullPage: false })
        base.screenshotDesktop = dPath
      } catch (e) {
        log.warn('Desktop-Screenshot fehlgeschlagen:', domain, e)
      }
      if (!opts.light) {
        try {
          await page.setViewportSize({ width: 390, height: 844 })
          await page.waitForTimeout(600)
          const mPath = join(screenshotsDir(), `${safe}_${stamp}_mobile.png`)
          await page.screenshot({ path: mPath, fullPage: false })
          base.screenshotMobile = mPath
        } catch (e) {
          log.warn('Mobil-Screenshot fehlgeschlagen:', domain, e)
        }
      }
    }
  } catch (e: unknown) {
    base.reachable = false
    base.error = e instanceof Error ? e.message : String(e)
    log.warn('Analyse fehlgeschlagen für', url, '-', base.error)
  } finally {
    try {
      await page?.close()
    } catch {
      /* ignore */
    }
  }
  return base
}

function guessAudience(corpus: string): string {
  const t = corpus.toLowerCase()
  if (/gewerbe|b2b|unternehmen|industrie|objekt/.test(t)) return 'Gewerbe / B2B'
  if (/privat|eigenheim|zuhause|familie|hausbesitzer/.test(t)) return 'Privatkunden / Eigenheimbesitzer'
  return 'Privat- & Gewerbekunden (gemischt)'
}

function emptyFeatures(): WebsiteFeatures {
  return {
    contactForm: false,
    onlineBooking: false,
    whatsapp: false,
    phoneClickToCall: false,
    reviews: false,
    beforeAfter: false,
    faq: false,
    career: false,
    gallery: false,
    newsletter: false,
    liveChat: false,
    multiLanguage: false,
    cookieBanner: false
  }
}
