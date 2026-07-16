import type { DetectedColor } from '@shared/types'
import { BrowserManager } from './browser'
import { auditCustomerColors } from './customerColorAuditService'
import { log } from '../utils/logger'

/**
 * Markenfarben-Erkennung von Website A.
 * Dünner Wrapper um die Audit-Pipeline (Mehrseiten-Crawl, CSS-Variablen,
 * computed UI-Styles mit Flächengewichtung, Cookie-/Widget-/Foto-Filter).
 */
export async function detectBrandColors(bm: BrowserManager, url: string): Promise<{ colors: DetectedColor[]; cookieFound: boolean }> {
  try {
    const audit = await auditCustomerColors(bm, url)
    return { colors: audit.candidates, cookieFound: audit.cookieFiltered }
  } catch (e) {
    log.warn('Markenfarben-Erkennung fehlgeschlagen:', e)
    return { colors: [], cookieFound: false }
  }
}
