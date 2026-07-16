import type { ReferenceBlueprint, PreviewSectionType, BlueprintBlock } from '@shared/types'
import { BrowserManager } from './browser'
import { log } from '../utils/logger'

/* eslint-disable */
function blueprintScript() {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const rgb = (v: string): { r: number; g: number; b: number; a: number } | null => {
    const m = v && v.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x.trim()))
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const lum = (c: { r: number; g: number; b: number }) => (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255

  // ── Header/Nav ──
  const header = document.querySelector('header, [class*="header"], nav') as HTMLElement | null
  let navPosition: 'over-hero' | 'top-bar' = 'top-bar'
  let navSticky = false
  let logoPosition: 'left' | 'center' = 'left'
  let headerDark = false
  if (header) {
    const cs = getComputedStyle(header)
    navSticky = cs.position === 'fixed' || cs.position === 'sticky'
    const bg = rgb(cs.backgroundColor)
    // transparent/durchsichtig über Bild → over-hero
    if (!bg || bg.a < 0.5) navPosition = 'over-hero'
    else if (lum(bg) < 0.35) headerDark = true
    const logo = header.querySelector('img, svg, [class*="logo"]') as HTMLElement | null
    if (logo) {
      const r = logo.getBoundingClientRect()
      const cx = r.left + r.width / 2
      if (cx > vw * 0.35 && cx < vw * 0.65) logoPosition = 'center'
    }
  }

  // ── Hero: großes Bild/BG im oberen Viewport? ──
  let heroImgArea = 0
  let heroEl: HTMLElement | null = null
  const candidates = Array.from(document.querySelectorAll('section, div, header, figure')).slice(0, 400) as HTMLElement[]
  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    if (r.top > vh * 0.7 || r.height < vh * 0.35 || r.width < vw * 0.7) continue
    const cs = getComputedStyle(el)
    const hasBgImg = cs.backgroundImage && cs.backgroundImage.includes('url(')
    const bigImg = el.querySelector('img') as HTMLImageElement | null
    const imgOk = bigImg && bigImg.getBoundingClientRect().width > vw * 0.6 && bigImg.getBoundingClientRect().height > vh * 0.35
    if (hasBgImg || imgOk) {
      const area = r.width * r.height
      if (area > heroImgArea) {
        heroImgArea = area
        heroEl = el
      }
    }
  }
  const heroRect = heroEl ? heroEl.getBoundingClientRect() : null
  const fullWidthHero = !!heroRect && heroRect.width >= vw * 0.92
  const tallHero = !!heroRect && heroRect.height >= vh * 0.6

  // Hero-Text: größte Überschrift im Hero-Bereich
  let heroTextAlign: 'left' | 'center' | 'right' = 'center'
  let heroTextColor: 'light' | 'dark' = 'dark'
  let heroOverlay = false
  const h1 = document.querySelector('h1, [class*="hero"] h2') as HTMLElement | null
  if (h1) {
    const r = h1.getBoundingClientRect()
    const cs = getComputedStyle(h1)
    const cx = r.left + r.width / 2
    if (cs.textAlign === 'center' || (cx > vw * 0.38 && cx < vw * 0.62)) heroTextAlign = 'center'
    else if (cx >= vw * 0.62) heroTextAlign = 'right'
    else heroTextAlign = 'left'
    const col = rgb(cs.color)
    if (col && lum(col) > 0.72) {
      heroTextColor = 'light'
      heroOverlay = true // helle Schrift auf Bild → Overlay-Komposition
    }
  }

  // ── Slider/Scroll-Indikatoren ──
  const hasSlider = !!document.querySelector('[class*="swiper"], [class*="slider"], [class*="carousel"], [class*="slick"], [class*="splide"]')
  const scrollIndicator = !!document.querySelector('[class*="scroll-down"], [class*="scrolldown"], [class*="arrow-down"], [class*="mouse"], a[href="#content"], a[href^="#sec"]')

  // ── Reservierungs-CTA im Header? ──
  const headerText = header ? (header.innerText || '').toLowerCase() : ''
  const reservationCta = /reservier|book|tisch|termin|buchen/.test(headerText)

  // ── Seitenkörper: Helligkeit + Bilddominanz ──
  const bodyBg = rgb(getComputedStyle(document.body).backgroundColor)
  const pageDarkness = bodyBg ? 1 - lum(bodyBg) : 0.1
  let imgArea = 0
  Array.from(document.images).forEach((im) => {
    const r = im.getBoundingClientRect()
    imgArea += Math.max(0, r.width) * Math.max(0, r.height)
  })
  const docH = Math.max(document.body.scrollHeight, vh)
  const imageDominant = imgArea / (vw * docH) > 0.28 || (fullWidthHero && tallHero)

  // ── Typografie: Serif in Headlines? ──
  const hFont = h1 ? getComputedStyle(h1).fontFamily.toLowerCase() : ''
  const serif = /(garamond|playfair|georgia|cormorant|didot|times|prata|cinzel|serif)/.test(hFont) && !hFont.startsWith('sans')

  // ── Button-Radius ──
  let radius: 'scharf' | 'soft' | 'rund' = 'soft'
  const btn = document.querySelector('a[class*="btn"], button, [class*="button"]') as HTMLElement | null
  if (btn) {
    const br = parseFloat(getComputedStyle(btn).borderRadius) || 0
    const h = btn.getBoundingClientRect().height || 40
    radius = br < 4 ? 'scharf' : br >= h / 2 - 2 ? 'rund' : 'soft'
  }

  // ── Nav-CTA (separater Button in der Kopfzeile) ──
  let navHasCta = false
  if (header) {
    const navBtn = header.querySelector('a[class*="btn"], a[class*="button"], button, [class*="cta"]') as HTMLElement | null
    if (navBtn) {
      const t = (navBtn.innerText || '').toLowerCase().trim()
      if (t && t.length < 30 && /reservier|book|tisch|termin|buchen|kontakt|anfrag|call|jetzt|order|bestell/.test(t)) navHasCta = true
    }
  }

  // ── Sektionen: ECHTE Struktur-Sequenz von B klassifizieren ──
  const headings = Array.from(document.querySelectorAll('h2')).slice(0, 10).map((h) => (h as HTMLElement).innerText.trim().slice(0, 40)).filter(Boolean)

  const classify = (el: HTMLElement): string => {
    const r = el.getBoundingClientRect()
    const secW = r.width || vw
    const secH = r.height || 1
    const imgs = Array.from(el.querySelectorAll('img')).filter((im) => {
      const ir = (im as HTMLElement).getBoundingClientRect()
      return ir.width > 40 && ir.height > 40
    }) as HTMLImageElement[]
    const csEl = getComputedStyle(el)
    const hasBgImg = csEl.backgroundImage && csEl.backgroundImage.includes('url(')
    const text = (el.innerText || '').trim()
    const textLen = text.length
    // größtes Bild in dieser Sektion
    let maxImgW = 0
    let maxImgArea = 0
    imgs.forEach((im) => {
      const ir = im.getBoundingClientRect()
      maxImgW = Math.max(maxImgW, ir.width)
      maxImgArea = Math.max(maxImgArea, ir.width * ir.height)
    })
    // Wiederholte Kind-Blöcke (Karten-Raster)?
    const kids = Array.from(el.children) as HTMLElement[]
    let gridChildren = 0
    for (const k of kids) {
      const kcs = getComputedStyle(k)
      if (kcs.display.includes('grid') || kcs.display.includes('flex')) {
        const gc = Array.from(k.children).filter((c) => (c as HTMLElement).getBoundingClientRect().height > 60)
        gridChildren = Math.max(gridChildren, gc.length)
      }
    }
    // CTA-Leiste: kurzer Block mit Button + Reservierungs-/Kontaktbegriff
    const btnEl = el.querySelector('a[class*="btn"], button, [class*="button"], a[class*="cta"]')
    const low = text.toLowerCase()
    const ctaWords = /reservier|tisch|termin|buchen|book|kontakt|anfrag|jetzt|besuch|öffnungszeit/.test(low)

    // Klassifikation (Reihenfolge = Priorität)
    if (imgs.length >= 4 && maxImgW < secW * 0.6) return 'gallery'
    if (gridChildren >= 3 && textLen > 60) return 'cards'
    if (maxImgW >= secW * 0.28 && maxImgW <= secW * 0.68 && textLen > 120 && imgs.length >= 1) return 'split'
    if ((hasBgImg || maxImgArea > secW * secH * 0.5) && textLen < 220) return 'image'
    if (secH < vh * 0.45 && btnEl && ctaWords && textLen < 320) return 'cta'
    if (gridChildren >= 3) return 'cards'
    if (imgs.length >= 1 && textLen > 80) return 'split'
    return 'text'
  }

  // Kandidaten sammeln: <section>-Tags + direkte Kinder des Hauptcontainers (fängt div-basierte One-Pager)
  const mainC = (document.querySelector('main') as HTMLElement | null) || document.body
  const candSet = new Set<HTMLElement>()
  ;(Array.from(document.querySelectorAll('section')) as HTMLElement[]).forEach((s) => candSet.add(s))
  ;(Array.from(mainC.children) as HTMLElement[]).forEach((s) => candSet.add(s))
  // Falls der Container nur wenige große Wrapper hat: eine Ebene tiefer scannen (div-basierte Seiten)
  ;(Array.from(mainC.children) as HTMLElement[]).forEach((c) => {
    const big = Array.from(c.children).filter((k) => (k as HTMLElement).getBoundingClientRect().height >= 160) as HTMLElement[]
    if (big.length >= 3) big.forEach((s) => candSet.add(s))
  })

  let cand = Array.from(candSet).filter((el) => {
    const r = el.getBoundingClientRect()
    return r.height >= 200 && r.width >= vw * 0.5
  })
  // Hero-interne Blöcke nicht separat zählen
  if (heroEl) cand = cand.filter((el) => el === heroEl || !heroEl!.contains(el))
  // Wrapper verwerfen, die andere Kandidaten umschließen → innere Sektionen behalten (Hero ausgenommen)
  cand = cand.filter((el) => el === heroEl || !cand.some((o) => o !== el && o !== heroEl && el.contains(o)))
  // nach vertikaler Position ordnen (echte Reihenfolge)
  cand.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)

  const rawSeq: string[] = []
  let heroMarked = false
  for (const s of cand) {
    const isFooter = s.tagName === 'FOOTER' || /footer/i.test(s.className || '')
    if (!heroMarked && heroEl && (s === heroEl || s.contains(heroEl) || heroEl.contains(s))) {
      rawSeq.push('hero'); heroMarked = true; continue
    }
    if (isFooter) { rawSeq.push('footer'); continue }
    rawSeq.push(classify(s))
    if (rawSeq.length >= 16) break
  }
  // Hero immer an den Anfang (Startseiten-Hero ist der oberste Block)
  const withoutHero = rawSeq.filter((x) => x !== 'hero')
  let sequence = ['hero', ...withoutHero]
  // aufeinanderfolgende gleiche Blöcke zusammenfassen (echter Layout-Rhythmus statt Wiederholungs-Rauschen)
  sequence = sequence.filter((x, i) => i === 0 || x !== sequence[i - 1])
  // Footer ans Ende
  sequence = sequence.filter((x) => x !== 'footer')
  const hadFooter = rawSeq.includes('footer')

  // ── Footer-Struktur ──
  const footerEl = document.querySelector('footer, [class*="footer"]') as HTMLElement | null
  let footerColumns = 1
  if (footerEl) {
    const fk = Array.from(footerEl.children) as HTMLElement[]
    for (const k of fk) {
      const kcs = getComputedStyle(k)
      if (kcs.display.includes('grid') || kcs.display.includes('flex')) {
        footerColumns = Math.max(footerColumns, Array.from(k.children).filter((c) => (c as HTMLElement).getBoundingClientRect().height > 30).length)
      }
    }
  }
  if ((footerEl || hadFooter) && !sequence.includes('footer')) sequence.push('footer')

  const sectionCount = sequence.filter((x) => x !== 'footer').length

  return {
    fullWidthHero, tallHero, heroTextAlign, heroTextColor, heroOverlay,
    navPosition, navSticky, logoPosition, headerDark, reservationCta, navHasCta,
    hasSlider, scrollIndicator, pageDarkness, imageDominant, serif, radius,
    sectionCount: Math.min(sectionCount, 12), headings, sequence, footerColumns: Math.min(footerColumns, 6)
  }
}
/* eslint-enable */

/** Analysiert Referenz B live und baut die Layout-Blueprint (echte DOM-Analyse). */
export async function extractReferenceBlueprint(bm: BrowserManager, url: string): Promise<ReferenceBlueprint> {
  const fail: ReferenceBlueprint = {
    url, ok: false, heroType: 'standard', heroOverlay: false, heroTextAlign: 'center', heroTextColor: 'dark',
    navPosition: 'top-bar', navSticky: false, logoPosition: 'left', reservationCta: false, imageDominant: false,
    backgroundStyle: 'light', darkness: 0.2, typography: 'modern-sans', cornerRadius: 'soft',
    hasSlider: false, scrollIndicator: false, sectionCount: 0, sectionHeadings: [],
    sectionSequence: [], navHasCta: false, footerColumns: 1, notes: ['Analyse fehlgeschlagen']
  }
  let page
  try {
    page = await bm.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2600) // Slider/Lazy-Hero + nachladende Sektionen
    // etwas scrollen, damit Lazy-Sektionen im DOM erscheinen, dann zurück
    try {
      await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.6); })
      await page.waitForTimeout(500)
      await page.evaluate(() => { window.scrollTo(0, 0); })
      await page.waitForTimeout(300)
    } catch {}
    const raw = (await page.evaluate(blueprintScript)) as ReturnType<typeof blueprintScript>

    const heroType: ReferenceBlueprint['heroType'] = raw.fullWidthHero && raw.tallHero ? 'cinematic-full' : raw.fullWidthHero ? 'cinematic-full' : raw.tallHero ? 'split-image' : 'standard'
    const dark = raw.pageDarkness >= 0.5 || raw.headerDark
    const notes: string[] = []
    if (raw.fullWidthHero) notes.push('Vollbild-Hero erkannt')
    if (raw.headerDark) notes.push('dunkle Header-Leiste')
    if (raw.heroOverlay) notes.push('helle Schrift über Bild (Overlay)')
    if (raw.hasSlider) notes.push('Slider/Carousel')
    if (raw.scrollIndicator) notes.push('Scroll-Indikator')
    if (raw.reservationCta) notes.push('Reservierungs-CTA im Header')

    const allowed = new Set(['hero', 'image', 'split', 'cards', 'gallery', 'text', 'stats', 'cta', 'footer'])
    const sectionSequence = (raw.sequence || []).filter((x): x is BlueprintBlock => allowed.has(x))
    if (raw.navHasCta) notes.push('separater CTA in der Kopfzeile')
    if (sectionSequence.length) notes.push(`Struktur: ${sectionSequence.join(' → ')}`)

    const bp: ReferenceBlueprint = {
      url,
      ok: true,
      heroType,
      heroOverlay: raw.heroOverlay || (heroType === 'cinematic-full' && raw.heroTextColor === 'light'),
      heroTextAlign: raw.heroTextAlign,
      heroTextColor: raw.heroTextColor,
      // dunkle, feste Kopfleiste = top-bar; transparente Nav über Bild = over-hero
      navPosition: raw.navPosition,
      navSticky: raw.navSticky,
      logoPosition: raw.logoPosition,
      reservationCta: raw.reservationCta,
      imageDominant: raw.imageDominant,
      backgroundStyle: dark ? 'dark' : raw.pageDarkness > 0.12 ? 'cream' : 'light',
      darkness: Number(raw.pageDarkness.toFixed(2)),
      typography: raw.serif ? 'serif-display' : 'modern-sans',
      cornerRadius: raw.radius,
      hasSlider: raw.hasSlider,
      scrollIndicator: raw.scrollIndicator,
      sectionCount: raw.sectionCount,
      sectionHeadings: raw.headings,
      sectionSequence,
      navHasCta: raw.navHasCta,
      footerColumns: raw.footerColumns,
      notes
    }
    log.info(`Blueprint (${url}): hero=${bp.heroType}/${bp.heroTextAlign} nav=${bp.navPosition} navCta=${bp.navHasCta} seq=[${bp.sectionSequence.join(',')}] dark=${bp.darkness} serif=${bp.typography}`)
    return bp
  } catch (e) {
    log.warn('Blueprint-Extraktion fehlgeschlagen:', e)
    return fail
  } finally {
    try { await page?.close() } catch {}
  }
}

/** Ordnungs-Ähnlichkeit zweier Block-Sequenzen (0..1) über die längste gemeinsame Teilfolge. */
function seqSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  return dp[m][n] / Math.max(m, n)
}

/**
 * Blueprint-Match: Wie stark folgt das erzeugte Konzept der ECHTEN Referenz-Struktur?
 * Harte Caps (Vorgabe): Hero-Struktur unpassend → max 70; Nav unpassend → max 75;
 * CTA-Position unpassend → max 80; Sektionsreihenfolge unpassend → max 80.
 */
export function blueprintMatchScore(
  bp: ReferenceBlueprint,
  concept: { heroType: string; overlay: boolean; backgroundStyle: string; typography: string; heroAlign?: string; navHasCta?: boolean },
  navOverHero: boolean,
  generatedSeq: string[] = []
): { score: number; notes: string[] } {
  if (!bp.ok) return { score: 50, notes: ['Referenz konnte nicht vollständig analysiert werden – Fallback-Konzept genutzt.'] }
  const notes: string[] = []
  let score = 100
  const caps: number[] = []

  if (bp.heroType !== concept.heroType) { score -= 30; caps.push(70); notes.push(`Hero-Struktur weicht ab (Referenz: ${bp.heroType})`) }
  if (concept.heroAlign && bp.heroTextAlign !== concept.heroAlign) { score -= 8; notes.push(`Hero-Textausrichtung weicht ab (Referenz: ${bp.heroTextAlign})`) }
  // Vollbild-Hero impliziert Text-über-Bild → Overlay zählt dann als getroffen
  const bpOverlayExpected = bp.heroOverlay || bp.heroType === 'cinematic-full'
  if (bpOverlayExpected !== concept.overlay) { score -= 12; notes.push('Overlay-Komposition weicht ab') }
  const bpDarkish = bp.backgroundStyle === 'dark'
  if (bpDarkish !== (concept.backgroundStyle === 'dark')) { score -= 12; notes.push('Hell/Dunkel-Charakter weicht ab') }
  if (bp.typography !== concept.typography) { score -= 10; notes.push('Typografie-Gefühl weicht ab') }
  if ((bp.navPosition === 'over-hero') !== navOverHero) { score -= 12; caps.push(75); notes.push('Navigationsposition weicht ab') }
  if (concept.navHasCta != null && bp.navHasCta !== concept.navHasCta) { score -= 8; caps.push(80); notes.push('CTA-Position in der Kopfzeile weicht ab') }

  // Sektionsreihenfolge (Kern): folgt die Vorschau der echten Block-Sequenz von B?
  if (bp.sectionSequence?.length && generatedSeq.length) {
    const sim = seqSimilarity(bp.sectionSequence, generatedSeq)
    if (sim < 0.6) { score -= 22; caps.push(80); notes.push(`Sektionsreihenfolge weicht ab (Übereinstimmung ${Math.round(sim * 100)}%)`) }
    else if (sim < 0.85) { score -= 8; notes.push(`Sektionsreihenfolge leicht abweichend (${Math.round(sim * 100)}%)`) }
  }

  const capped = caps.length ? Math.min(score, ...caps) : score
  return { score: Math.max(0, Math.round(capped)), notes }
}

/**
 * Übersetzt die ECHTE Block-Sequenz von B in die Kunden-Sektionsreihenfolge.
 * B bestimmt Reihenfolge/Rhythmus; die Inhalte kommen später von Kunde A.
 * Gibt zusätzlich die tatsächlich gefolgte Block-Sequenz zurück (für den Match-Score).
 */
export function blueprintSectionPlan(bp: ReferenceBlueprint, restaurant: boolean): { order: PreviewSectionType[]; blocks: BlueprintBlock[] } {
  const seq = bp.sectionSequence?.length ? bp.sectionSequence : (['hero', 'split', 'cards', 'gallery', 'cta', 'footer'] as BlueprintBlock[])
  const order: PreviewSectionType[] = ['header']
  const blocks: BlueprintBlock[] = []
  const used = new Set<PreviewSectionType>(['header'])
  let cardsSeen = 0
  let textSeen = 0
  let gallerySeen = 0

  const add = (t: PreviewSectionType, b: BlueprintBlock, allowRepeat = false) => {
    if (!allowRepeat && used.has(t)) return
    order.push(t)
    used.add(t)
    blocks.push(b)
  }

  for (const block of seq) {
    if (order.filter((o) => o !== 'header').length >= 9) break
    switch (block) {
      case 'hero':
        add('hero', 'hero')
        break
      case 'image':
        // großflächige Bildfläche → als Galerie-/Showcase-Block (max 2)
        if (gallerySeen < 2) { add('gallery', 'image', gallerySeen > 0); gallerySeen++ }
        break
      case 'gallery':
        if (gallerySeen < 2) { add('gallery', 'gallery', gallerySeen > 0); gallerySeen++ }
        break
      case 'split':
        if (!used.has('about')) add('about', 'split')
        else add('benefits', 'split')
        break
      case 'cards':
        if (cardsSeen === 0) add(restaurant ? 'menu' : 'services', 'cards')
        else add('benefits', 'cards')
        cardsSeen++
        break
      case 'text':
        if (textSeen === 0 && !used.has('about')) add('about', 'text')
        else add('benefits', 'text')
        textSeen++
        break
      case 'stats':
        add('trust', 'stats')
        break
      case 'cta':
        add('contact', 'cta')
        break
      case 'footer':
        // Footer am Ende erzwingen (siehe unten)
        break
    }
  }

  // Hero direkt nach Header sicherstellen
  if (!used.has('hero')) { order.splice(1, 0, 'hero'); blocks.unshift('hero'); used.add('hero') }
  // Kontakt + Footer garantieren
  if (!used.has('contact')) { order.push('contact'); blocks.push('cta'); used.add('contact') }
  order.push('footer')
  blocks.push('footer')

  return { order, blocks }
}
