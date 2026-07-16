import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { SavedPreview } from '@shared/types'
import { log } from '../utils/logger'

function dir(): string {
  const base = process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
  const d = join(base, 'previews')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

export function savePreview(p: SavedPreview): void {
  writeFileSync(join(dir(), `${p.id}.json`), JSON.stringify(p, null, 2), 'utf-8')
  log.info('Vorschau gespeichert:', p.id)
}

/** Liste ohne das (große) result-Feld – für Übersichten. */
export function listPreviews(): Omit<SavedPreview, 'result'>[] {
  const out: Omit<SavedPreview, 'result'>[] = []
  for (const f of readdirSync(dir())) {
    if (!f.endsWith('.json')) continue
    try {
      const p = JSON.parse(readFileSync(join(dir(), f), 'utf-8')) as SavedPreview
      const { result: _r, ...rest } = p
      void _r
      out.push(rest)
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function loadPreview(id: string): SavedPreview | null {
  const path = join(dir(), `${id}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SavedPreview
  } catch {
    return null
  }
}

export function deletePreview(id: string): boolean {
  const path = join(dir(), `${id}.json`)
  if (!existsSync(path)) return false
  unlinkSync(path)
  return true
}
