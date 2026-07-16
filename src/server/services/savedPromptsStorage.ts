import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { SavedPrompt } from '@shared/types'
import { log } from '../utils/logger'

function promptsDir(): string {
  const base = process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
  const dir = join(base, 'prompts')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function savePrompt(p: SavedPrompt): void {
  writeFileSync(join(promptsDir(), `${p.id}.json`), JSON.stringify(p, null, 2), 'utf-8')
  log.info('Prompt gespeichert:', p.id)
}

export function listPrompts(): SavedPrompt[] {
  const dir = promptsDir()
  const out: SavedPrompt[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    try {
      out.push(JSON.parse(readFileSync(join(dir, file), 'utf-8')) as SavedPrompt)
    } catch {
      /* defekte Datei überspringen */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function loadPrompt(id: string): SavedPrompt | null {
  const path = join(promptsDir(), `${id}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SavedPrompt
  } catch {
    return null
  }
}

export function deletePrompt(id: string): boolean {
  const path = join(promptsDir(), `${id}.json`)
  if (!existsSync(path)) return false
  unlinkSync(path)
  return true
}
