import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { SavedProjectPalette } from '@shared/types'
import { log } from '../utils/logger'

function dir(): string {
  const base = process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
  const d = join(base, 'palettes')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}
const safe = (id: string) => id.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)

export function saveProjectPalette(p: SavedProjectPalette): void {
  if (!p.projectId) return
  writeFileSync(join(dir(), `${safe(p.projectId)}.json`), JSON.stringify(p, null, 2), 'utf-8')
  log.info('Kundenpalette gespeichert:', p.projectId)
}

export function loadProjectPalette(projectId: string): SavedProjectPalette | null {
  if (!projectId) return null
  const path = join(dir(), `${safe(projectId)}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SavedProjectPalette
  } catch {
    return null
  }
}
