import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { DetectedColor, ColorRole } from '@shared/types'
import { log } from '../utils/logger'

/** Pro Kunden-DOMAIN gespeicherte Farbanalyse (Wiederverwendung statt Neu-Raten). */
export interface SavedCustomerPalette {
  domain: string
  updatedAt: string
  detected: DetectedColor[]
  roles: Partial<Record<ColorRole, string>>
  overallConfidence: number
  locked?: boolean
}

function dir(): string {
  const base = process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
  const d = join(base, 'customer-palettes')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}
const fileFor = (domain: string) => join(dir(), domain.replace(/[^a-z0-9.-]/gi, '_').slice(0, 80) + '.json')

export function saveCustomerPalette(p: SavedCustomerPalette): void {
  if (!p.domain) return
  // Gesperrte Palette nie durch Auto-Save überschreiben
  const existing = loadCustomerPalette(p.domain)
  if (existing?.locked && !p.locked) return
  writeFileSync(fileFor(p.domain), JSON.stringify({ ...p, updatedAt: new Date().toISOString() }, null, 2), 'utf-8')
  log.info('Kundenpalette gespeichert für Domain:', p.domain)
}

export function loadCustomerPalette(domain: string): SavedCustomerPalette | null {
  const f = fileFor(domain)
  if (!existsSync(f)) return null
  try {
    return JSON.parse(readFileSync(f, 'utf-8')) as SavedCustomerPalette
  } catch {
    return null
  }
}
