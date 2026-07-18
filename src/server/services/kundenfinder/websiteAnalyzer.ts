import type { WebsiteAnalysis } from '@shared/kundenfinder'
import { classifyWebsiteState } from '@shared/websiteState'
import { BrowserManager } from '../browser'
import { normalizeUrl } from '../../utils/url'
import { log } from '../../utils/logger'

const safeHost = (u: string): string | undefined => { try { return new URL(u).host } catch { return undefined } }

/** SSRF-Schutz: interne/private Hosts niemals analysieren. */
export function isInternalHost(url: string): boolean {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return true
  }
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host)
  )
}

/* eslint-disable */
function analyzeScript() {
  const text = (document.body?.innerText || '').toLowerCase()
  const vw = window.innerWidth
  const title = (document.title || '').trim()
  const metaDesc = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null)?.content?.trim() || ''
  const viewport = !!document.querySelector('meta[name="viewport"]')
  const h1 = document.querySelectorAll('h1').length
  const imgs = document.images.length
  const links = Array.from(document.querySelectorAll('a')).map((a) => (a.getAttribute('href') || '').toLowerCase())
  const hasTel = links.some((h) => h.startsWith('tel:')) || /\b0\d[\d\s/().-]{5,}/.test(text)
  const hasMailto = links.some((h) => h.startsWith('mailto:')) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(text)
  const hasImpressum = links.some((h) => /impressum/.test(h)) || /impressum/.test(text)
  const hasDatenschutz = links.some((h) => /datenschutz/.test(h)) || /datenschutz/.test(text)
  const hasContactPage = links.some((h) => /kontakt|contact/.test(h))
  const hasForm = !!document.querySelector('form')
  const cookieBanner = /cookie|consent|datenschutz-einstellung/.test((document.body?.innerHTML || '').slice(0, 6000).toLowerCase())
  const buttons = document.querySelectorAll('a[class*="btn" i],button,[class*="cta" i]').length
  const navItems = document.querySelectorAll('header a, nav a').length
  const textLen = text.length
  // Copyright-Jahr
  const years = (text.match(/(?:©|copyright|&copy;)\s*\D{0,6}(20\d{2})/g) || []).map((m) => parseInt((m.match(/20\d{2}/) || ['0'])[0], 10))
  const copyrightYear = years.length ? Math.max(...years) : 0
  // horizontale Überläufe (Hinweis auf fehlende Responsivität bei schmaler Breite)
  const scrollW = document.documentElement.scrollWidth
  const overflow = scrollW > vw + 24
  return {
    title, metaDesc, viewport, h1, imgs, hasTel, hasMailto, hasImpressum, hasDatenschutz, hasContactPage, hasForm,
    cookieBanner, buttons, navItems, textLen, copyrightYear, overflow, vw, scrollW,
    // Sichtbarer Text (gerendert, inkl. JS-Inhalt) für die Zustands-Klassifizierung.
    sample: text.slice(0, 5000)
  }
}
/* eslint-enable */

/** Analysiert eine Website und berechnet das Website-Verbesserungspotenzial (0..100). */
export async function analyzeWebsite(bm: BrowserManager, rawUrl?: string): Promise<WebsiteAnalysis> {
  const analyzedAt = new Date().toISOString()
  const url = rawUrl ? normalizeUrl(rawUrl) || '' : ''
  if (!url) {
    return {
      url: '',
      reachable: false,
      https: false,
      hasWebsite: false,
      score: 92,
      breakdown: { technik: 25, mobile: 20, performance: 12, design: 18, inhalt: 12, aktualitaet: 5 },
      issues: ['Keine Website gefunden – sehr hohes Potenzial für eine neue Website.'],
      analyzedAt,
      state: 'keine',
      stateReason: 'Für dieses Unternehmen ist keine Website hinterlegt.'
    }
  }
  if (isInternalHost(url)) {
    return { url, reachable: false, https: false, hasWebsite: true, score: 0, breakdown: { technik: 0, mobile: 0, performance: 0, design: 0, inhalt: 0, aktualitaet: 0 }, issues: ['Interne/geschützte URL – nicht analysiert.'], analyzedAt }
  }

  let page
  const issues: string[] = []
  const https = url.startsWith('https://')
  try {
    page = await bm.newPage()
    await page.setViewportSize({ width: 390, height: 850 }) // mobile-first prüfen
    const t0 = Date.now()
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    const loadMs = Date.now() - t0
    await page.waitForTimeout(1200)
    const ok = !!resp && resp.status() < 400
    if (!ok) {
      return { url, reachable: false, https, hasWebsite: true, score: 85, breakdown: { technik: 22, mobile: 18, performance: 12, design: 16, inhalt: 12, aktualitaet: 5 }, issues: [`Website nicht erreichbar (Status ${resp?.status() ?? 'kein Response'}).`], analyzedAt, state: 'nicht_erreichbar', stateReason: `Die Website hat nicht geantwortet (Status ${resp?.status() ?? 'kein Response'}).` }
    }
    const finalUrl = page.url()
    const m = (await page.evaluate(analyzeScript)) as ReturnType<typeof analyzeScript>

    // ── Gewichtete Bewertung: mehr Probleme = höheres Potenzial ──
    let technik = 0
    if (!https) { technik += 8; issues.push('Kein HTTPS / unsicheres Zertifikat.') }
    if (!m.title) { technik += 4; issues.push('Kein Seitentitel (<title>).') }
    if (!m.metaDesc) { technik += 4; issues.push('Keine Meta-Description.') }
    if (!m.viewport) { technik += 5; issues.push('Kein Viewport-Meta-Tag (nicht für Mobilgeräte optimiert).') }
    if (!m.h1) { technik += 4; issues.push('Keine H1-Überschrift / schwache Struktur.') }
    technik = Math.min(25, technik)

    let mobile = 0
    if (!m.viewport) mobile += 8
    if (m.overflow) { mobile += 12; issues.push('Auf Smartphones schlecht bedienbar (horizontaler Überlauf).') }
    mobile = Math.min(20, mobile)

    let performance = 0
    if (loadMs > 4000) { performance += 10; issues.push(`Ladezeit auffällig hoch (${(loadMs / 1000).toFixed(1)} s).`) }
    else if (loadMs > 2500) { performance += 6; issues.push(`Ladezeit erhöht (${(loadMs / 1000).toFixed(1)} s).`) }
    if (m.imgs > 45) { performance += 5; issues.push('Sehr viele Bilder – vermutlich unoptimiert.') }
    performance = Math.min(15, performance)

    let design = 0
    if (m.textLen < 600) { design += 6; issues.push('Sehr wenig Inhalt / dünne Startseite (Hinweis).') }
    if (m.buttons === 0 && !m.hasTel) { design += 7; issues.push('Keine klare Handlungsaufforderung / kein sichtbarer CTA (Hinweis).') }
    if (m.navItems < 3) { design += 7; issues.push('Navigation wirkt unklar oder minimal (Hinweis).') }
    design = Math.min(20, design)

    let inhalt = 0
    if (!m.hasTel) { inhalt += 6; issues.push('Telefonnummer nicht leicht auffindbar.') }
    if (!m.hasMailto && !m.hasContactPage) { inhalt += 5; issues.push('Keine leicht auffindbare Kontaktmöglichkeit.') }
    if (!m.hasImpressum) { inhalt += 4; issues.push('Kein Impressum auffindbar.') }
    inhalt = Math.min(15, inhalt)

    let aktualitaet = 0
    const year = new Date().getFullYear()
    if (m.copyrightYear && m.copyrightYear <= year - 2) { aktualitaet += 5; issues.push(`Copyright veraltet (${m.copyrightYear}).`) }
    aktualitaet = Math.min(5, aktualitaet)

    const score = Math.min(100, technik + mobile + performance + design + inhalt + aktualitaet)

    // Website-Zustand aus den gerenderten Metriken (leer/geparkt/… vs. vorhanden). Bewertet den
    // tatsächlich sichtbaren Text (§11) — nicht nur Statuscode oder HTML-Länge.
    const cls = classifyWebsiteState({
      hasWebsite: true, reachable: true, status: resp?.status(),
      finalUrl, originalHost: safeHost(url),
      title: m.title, text: m.sample, textLen: m.textLen, h1: m.h1, navItems: m.navItems, imgs: m.imgs,
      hasImpressum: m.hasImpressum, hasContactPage: m.hasContactPage
    })
    // Ist die Seite leer/geparkt o. Ä., aber der Punkte-Score stuft sie zu positiv ein? Dann Hinweis.
    if (cls.state !== 'vorhanden' && cls.state !== 'einfach' && cls.state !== 'schlecht') issues.unshift(cls.reason)

    log.info(`Website-Analyse ${url}: Potenzial ${score}, Zustand ${cls.state} (${loadMs}ms)`)
    return { url, reachable: true, https, hasWebsite: true, score, loadMs, breakdown: { technik, mobile, performance, design, inhalt, aktualitaet }, issues, analyzedAt, state: cls.state, stateReason: cls.reason }
  } catch (e) {
    return { url, reachable: false, https, hasWebsite: true, score: 80, breakdown: { technik: 20, mobile: 18, performance: 12, design: 15, inhalt: 10, aktualitaet: 5 }, issues: ['Analyse fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e))], analyzedAt, state: 'nicht_erreichbar', stateReason: 'Die Website konnte nicht analysiert werden.' }
  } finally {
    try {
      await page?.close()
    } catch {}
  }
}
