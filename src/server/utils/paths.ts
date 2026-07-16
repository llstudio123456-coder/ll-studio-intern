import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Web-Variante: alle Laufzeitdaten liegen unter .data/ im Projekt-Root.
 * Auf einem Node-Host (VPS, Render, Railway, Docker) ist das persistent.
 */
function dataRoot(): string {
  return process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
}

function ensure(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function storageDir(): string {
  return ensure(join(dataRoot(), 'projects'))
}
export function screenshotsDir(): string {
  return ensure(join(dataRoot(), 'screenshots'))
}
export function exportsDir(): string {
  return ensure(join(dataRoot(), 'exports'))
}
export function settingsFile(): string {
  ensure(dataRoot())
  return join(dataRoot(), 'settings.json')
}

export function ensureForFile(filePath: string): string {
  ensure(dirname(filePath))
  return filePath
}
