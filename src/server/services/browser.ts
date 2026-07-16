import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { log } from '../utils/logger'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Zentrale Verwaltung der Playwright-Browserinstanz.
 * Eine Instanz pro Lauf, mehrere Pages werden seriell genutzt.
 */
export class BrowserManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private headless: boolean

  constructor(headless = true) {
    this.headless = headless
  }

  async ensure(): Promise<BrowserContext> {
    if (this.context) return this.context
    log.info('Starte Chromium (headless:', this.headless, ')')
    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    })
    this.context = await this.browser.newContext({
      userAgent: UA,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      viewport: { width: 1366, height: 900 },
      ignoreHTTPSErrors: true
    })
    // einfache Anti-Automation-Maskierung
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    this.context.setDefaultNavigationTimeout(30000)
    this.context.setDefaultTimeout(20000)
    return this.context
  }

  async newPage(): Promise<Page> {
    const ctx = await this.ensure()
    return ctx.newPage()
  }

  async close(): Promise<void> {
    try {
      await this.context?.close()
      await this.browser?.close()
    } catch (e) {
      log.warn('Fehler beim Schließen des Browsers:', e)
    } finally {
      this.context = null
      this.browser = null
    }
  }

  isOpen(): boolean {
    return this.browser !== null
  }
}

/** Erkennt typische Captcha-/Blockierungs-Signale in HTML/URL. */
export function looksBlocked(html: string, url: string): boolean {
  const h = html.toLowerCase()
  return (
    h.includes('captcha') ||
    h.includes('unusual traffic') ||
    h.includes('ungewöhnliche aktivität') ||
    h.includes('are you a robot') ||
    h.includes('verify you are human') ||
    url.includes('/sorry/') ||
    url.includes('captcha')
  )
}
