import type { PreviewPalette, SourceCompany, InspirationReference, DesignPreviewResult } from '@shared/types'
import { BrowserManager } from './browser'
import { parseHex, sat } from './colorUtils'
import { customerImageUrls } from './aiPreviewPromptBuilder'
import { sanitizePreviewHtml } from './aiPreviewRenderer'
import { log } from '../utils/logger'

export interface CloneReport {
  ok: boolean
  refUrl: string
  externalSheets: number
  swappedImages: number
  swappedBackgrounds: number
  logoSwapped: boolean
  colorMap: { from: string; to: string }[]
  bytes: number
  notes: string[]
}

/* eslint-disable */
function snapshotScript(logoUrl: string) {
  const base = location.href
  const abs = (u: string) => {
    try {
      return new URL(u, base).href
    } catch {
      return u
    }
  }
  // Skripte/Interaktion entfernen (Sandbox-Sicherheit, wir wollen nur das Aussehen)
  document.querySelectorAll('script, noscript').forEach((s) => s.remove())

  // Logo von B finden und durch A-Logo ersetzen (im echten DOM = zuverlässig, auch bei SVG-Logos)
  let logoSwapped = false
  if (logoUrl) {
    const scope = (document.querySelector('header, [class*="header" i], nav') as HTMLElement) || document.body
    const origin = location.origin
    const logoEl =
      scope.querySelector('img[class*="logo" i], img[alt*="logo" i], [class*="logo" i] img, [id*="logo" i] img, a[class*="logo" i] img') ||
      scope.querySelector('a[href="/"] img, a[href="' + origin + '/"] img, a[href="' + base + '"] img') ||
      scope.querySelector('header img, nav img') ||
      scope.querySelector('[class*="logo" i] svg, a[href="/"] svg, header svg, nav svg') ||
      scope.querySelector('img')
    if (logoEl && logoEl.parentElement) {
      const img = document.createElement('img')
      img.setAttribute('src', logoUrl)
      img.setAttribute('alt', 'Logo')
      img.setAttribute('data-clone-logo', '1')
      img.setAttribute('style', 'max-height:52px;width:auto;max-width:220px;object-fit:contain;display:inline-block')
      logoEl.replaceWith(img)
      logoSwapped = true
    }
  }

  // Navigation stilllegen: Klicks dürfen NICHT auf die Original-Seite führen (sonst „reset“)
  document.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('href', '#')
    a.removeAttribute('target')
  })
  document.querySelectorAll('form').forEach((f) => {
    f.setAttribute('action', '#')
    f.setAttribute('method', 'get')
  })

  // CSS aus allen erreichbaren Stylesheets sammeln
  let css = ''
  const external: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = (sheet as CSSStyleSheet).cssRules
      if (!rules) {
        if (sheet.href) external.push(sheet.href)
        continue
      }
      const sheetBase = sheet.href || base
      let sheetCss = ''
      for (const rule of Array.from(rules)) sheetCss += (rule as CSSRule).cssText + '\n'
      sheetCss = sheetCss.replace(/url\((['"]?)(?!data:|https?:|\/\/)([^'")]+)\1\)/gi, (_m, q, u) => {
        try {
          return `url(${q}${new URL(u, sheetBase).href}${q})`
        } catch {
          return `url(${q}${u}${q})`
        }
      })
      css += sheetCss + '\n'
    } catch {
      if (sheet.href) external.push(sheet.href)
    }
  }

  // URLs im DOM absolut machen, damit die Seite eigenständig rendert
  document.querySelectorAll('[src]').forEach((el) => {
    const s = el.getAttribute('src')
    if (s) el.setAttribute('src', abs(s))
  })
  document.querySelectorAll('link[href]').forEach((el) => {
    const h = el.getAttribute('href')
    if (h) el.setAttribute('href', abs(h))
  })
  document.querySelectorAll('[srcset]').forEach((el) => {
    const ss = el.getAttribute('srcset')
    if (ss)
      el.setAttribute(
        'srcset',
        ss
          .split(',')
          .map((p) => {
            const parts = p.trim().split(/\s+/)
            return abs(parts[0]) + (parts[1] ? ' ' + parts[1] : '')
          })
          .join(', ')
      )
  })
  document.querySelectorAll('[style]').forEach((el) => {
    const st = el.getAttribute('style')
    if (st && st.includes('url('))
      el.setAttribute('style', st.replace(/url\((['"]?)(?!data:|https?:|\/\/)([^'")]+)\1\)/gi, (_m, q, u) => `url(${q}${abs(u)}${q})`))
  })

  const bodyHtml = document.body ? document.body.outerHTML : ''
  const lang = document.documentElement.getAttribute('lang') || 'de'
  const title = document.title || ''
  return { css, external, bodyHtml, lang, title, logoSwapped }
}

/* eslint-disable */
function detectLogoScript() {
  const abs = (u: string) => {
    try {
      return new URL(u, location.href).href
    } catch {
      return u
    }
  }
  const scope = (document.querySelector('header, [class*="header" i], nav') as HTMLElement) || document.body
  const origin = location.origin
  const img =
    scope.querySelector('img[class*="logo" i], img[alt*="logo" i], [class*="logo" i] img, [id*="logo" i] img, a[class*="logo" i] img') ||
    scope.querySelector('a[href="/"] img, a[href="' + origin + '/"] img') ||
    scope.querySelector('header img, nav img')
  const src = img && img.getAttribute('src')
  if (src) {
    const r = (img as HTMLElement).getBoundingClientRect()
    // sehr breite Banner ausschließen (eher Hero als Logo)
    if (!(r.width > 400 && r.height > 200)) return abs(src)
  }
  const og = document.querySelector('meta[property="og:logo"], meta[name="og:logo"]') as HTMLMetaElement | null
  if (og && og.content) return abs(og.content)
  const ati = document.querySelector('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]') as HTMLLinkElement | null
  if (ati && ati.getAttribute('href')) return abs(ati.getAttribute('href')!)
  const ic = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null
  if (ic && ic.getAttribute('href')) return abs(ic.getAttribute('href')!)
  return ''
}
/* eslint-enable */

/** Erkennt automatisch das Logo von Kunde A (Header-Logo, sonst og:logo/Touch-Icon/Favicon). */
export async function detectCustomerLogo(bm: BrowserManager, url: string): Promise<string | null> {
  let page
  try {
    page = await bm.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(1500)
    const logo = (await page.evaluate(detectLogoScript)) as string
    return logo || null
  } catch {
    return null
  } finally {
    try {
      await page?.close()
    } catch {}
  }
}

const norm6 = (h: string): string | null => {
  let x = (h || '').replace('#', '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(x)) x = x.split('').map((c) => c + c).join('')
  return /^[0-9a-f]{6}$/.test(x) ? x : null
}
const isNeutral = (hex6: string): boolean => {
  const c = parseHex('#' + hex6)
  return !c || sat(c) < 0.16
}

/** Ersetzt eine Farbe (hex/rgb/rgba) im gesamten HTML durch die Zielfarbe. */
function replaceColor(s: string, from6: string, to6: string): string {
  const f = parseHex('#' + from6)
  const t = parseHex('#' + to6)
  if (!f || !t) return s
  let out = s
  out = out.replace(new RegExp('#' + from6, 'gi'), '#' + to6)
  if (from6[0] === from6[1] && from6[2] === from6[3] && from6[4] === from6[5])
    out = out.replace(new RegExp('#' + from6[0] + from6[2] + from6[4] + '\\b', 'gi'), '#' + to6)
  out = out.replace(new RegExp(`rgb\\(\\s*${f.r}\\s*,\\s*${f.g}\\s*,\\s*${f.b}\\s*\\)`, 'gi'), `rgb(${t.r}, ${t.g}, ${t.b})`)
  out = out.replace(new RegExp(`rgba\\(\\s*${f.r}\\s*,\\s*${f.g}\\s*,\\s*${f.b}\\s*,`, 'gi'), `rgba(${t.r}, ${t.g}, ${t.b},`)
  return out
}

/** Farben von B auf die A-Palette abbilden (häufigste/Marken-Farben von B → A-Rollen). */
function remapColors(html: string, bColors: string[], aRoles: string[]): { html: string; map: { from: string; to: string }[] } {
  const freq: Record<string, number> = {}
  const re = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const h = norm6(m[1])
    if (h) freq[h] = (freq[h] || 0) + 1
  }
  const brand = bColors.map(norm6).filter((x): x is string => !!x)
  const ranked = Array.from(new Set([...brand, ...Object.keys(freq).sort((a, b) => freq[b] - freq[a])])).filter((h) => !isNeutral(h))
  const targets = aRoles.map(norm6).filter((x): x is string => !!x)
  const map: { from: string; to: string }[] = []
  let out = html
  ranked.slice(0, targets.length).forEach((from, i) => {
    const to = targets[i % targets.length]
    if (from === to) return
    out = replaceColor(out, from, to)
    map.push({ from: '#' + from, to: '#' + to })
  })
  return { html: out, map }
}

/** Setzt/überschreibt ein Attribut in einem <img …>-Tag-String. */
function setAttr(tag: string, attr: string, value: string): string {
  const re = new RegExp(`\\s${attr}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i')
  const inject = ` ${attr}="${value}"`
  return re.test(tag) ? tag.replace(re, inject) : tag.replace(/<img/i, `<img${inject}`)
}

const isLogoTag = (tag: string) => /logo|data-clone-logo/i.test(tag)

/** Tauscht Inhaltsbilder und große Hintergrundbilder gegen Bilder von Kunde A (Logo wird im Browser-DOM getauscht). */
function swapAssets(html: string, aImages: string[], report: CloneReport): string {
  let idx = 0
  const nextImage = () => (aImages.length ? aImages[idx++ % aImages.length] : null)
  let out = html

  // <img>-Tags (außer bereits getauschtes Logo) → A-Bild
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    if (isLogoTag(tag)) return tag
    const u = nextImage()
    if (!u) return tag
    report.swappedImages++
    return setAttr(setAttr(tag, 'srcset', ''), 'src', u)
  })

  // Große Hintergrundbilder (Fotos) → A-Bilder; Icons/Logos/Muster verschonen
  if (aImages.length) {
    out = out.replace(/url\((['"]?)(https?:\/\/[^'")]+?\.(?:jpg|jpeg|png|webp|avif)[^'")]*)\1\)/gi, (mm, q, u) => {
      if (/logo|icon|sprite|favicon|pattern|badge|flag/i.test(u)) return mm
      const a = nextImage()
      if (!a) return mm
      report.swappedBackgrounds++
      return `url(${q}${a}${q})`
    })
  }
  return out
}

/** Ersetzt den Firmennamen von B durch den von A (einfacher Textersatz). */
function swapName(html: string, bName: string | undefined, aName: string | undefined): string {
  if (!bName || !aName || bName.trim().length < 2) return html
  const esc = bName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(esc, 'gi'), aName)
}

/**
 * Lädt die Referenz-B-Seite, baut ein eigenständiges HTML (CSS inline, URLs absolut, Skripte entfernt)
 * und ersetzt Logo, Farben, Bilder und Namen durch die von Kunde A. Ergebnis wird sandboxed gerendert.
 */
export async function cloneReferenceWithCustomerAssets(
  bm: BrowserManager,
  refUrl: string,
  source: SourceCompany,
  inspiration: InspirationReference,
  result: DesignPreviewResult
): Promise<{ html: string; report: CloneReport }> {
  const report: CloneReport = {
    ok: false,
    refUrl,
    externalSheets: 0,
    swappedImages: 0,
    swappedBackgrounds: 0,
    logoSwapped: false,
    colorMap: [],
    bytes: 0,
    notes: []
  }
  let page
  try {
    // Logo von Kunde A: manuell hochgeladen ODER automatisch von A's Website erkennen
    let aLogo = source.logoDataUrl || ''
    if (!aLogo && source.url) {
      const detected = await detectCustomerLogo(bm, source.url)
      if (detected) {
        aLogo = detected
        report.notes.push('Kunde-A-Logo automatisch erkannt.')
      }
    }

    page = await bm.newPage()
    await page.goto(refUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2600)
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
      await page.waitForTimeout(500)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(300)
    } catch {}
    const snap = (await page.evaluate(snapshotScript, aLogo)) as ReturnType<typeof snapshotScript>
    report.logoSwapped = snap.logoSwapped

    // Externe (cross-origin) Stylesheets serverseitig nachladen & inlinen
    let css = snap.css
    report.externalSheets = snap.external.length
    for (const href of snap.external.slice(0, 12)) {
      try {
        const r = await fetch(href, { signal: AbortSignal.timeout(8000) })
        if (!r.ok) continue
        let text = await r.text()
        text = text.replace(/url\((['"]?)(?!data:|https?:|\/\/)([^'")]+)\1\)/gi, (_m, q, u) => {
          try {
            return `url(${q}${new URL(u, href).href}${q})`
          } catch {
            return `url(${q}${u}${q})`
          }
        })
        css += `\n/* extern: ${href} */\n` + text
      } catch {
        /* extern nicht ladbar – ignorieren */
      }
    }

    // <base> auf die B-Origin: verbleibende relative URLs laden von B – NICHT von localhost (unsere App).
    // Zusätzlich Links klick-inert machen: die Vorschau ist statisch, Klicks dürfen nirgendwohin navigieren.
    let refOrigin = ''
    try {
      refOrigin = new URL(refUrl).origin + '/'
    } catch {}
    const staticCss = 'a,a *{pointer-events:none !important;cursor:default !important}form{pointer-events:none}'
    let html = `<!doctype html><html lang="${snap.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${refOrigin ? `<base href="${refOrigin}">` : ''}<title>${(source.name || snap.title || 'Vorschau').replace(/[<>]/g, '')}</title><style>${css}</style><style>${staticCss}</style></head>${snap.bodyHtml}</html>`

    // ── Assets von Kunde A einsetzen ──
    const palette: PreviewPalette = result.concept.palette
    const aRoles = [palette.primary, palette.cta, palette.accent, palette.secondary, palette.ctaHover].filter(Boolean)
    const aImages = customerImageUrls(result, source)

    const recolored = remapColors(html, inspiration.colors || [], aRoles)
    html = recolored.html
    report.colorMap = recolored.map

    html = swapAssets(html, aImages, report)
    html = swapName(html, inspiration.companyName, source.name)

    // Sicherheit: verbleibende Skripte/Event-Handler/js:-URLs entfernen
    html = sanitizePreviewHtml(html)

    report.bytes = html.length
    report.ok = true
    if (!aImages.length) report.notes.push('Keine Kunde-A-Bilder vorhanden – Bilder von B bleiben sichtbar.')
    if (!report.logoSwapped) report.notes.push('Kein Kunde-A-Logo gefunden – Logo von B bleibt (Logo bei Kunde A hochladen).')
    if (report.externalSheets > 12) report.notes.push('Sehr viele externe Stylesheets – ggf. nicht alle inline übernommen.')
    log.info(`Klon (${refUrl}): imgs=${report.swappedImages} bg=${report.swappedBackgrounds} logo=${report.logoSwapped} farben=${report.colorMap.length} bytes=${report.bytes}`)
    return { html, report }
  } catch (e) {
    report.notes.push('Klon fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)))
    return { html: '', report }
  } finally {
    try {
      await page?.close()
    } catch {}
  }
}
