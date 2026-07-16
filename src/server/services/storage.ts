import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { AnalysisProject, InspirationSearchProject } from '@shared/types'
import { storageDir } from '../utils/paths'
import { log } from '../utils/logger'

/** Lokale Persistenz als JSON-Dateien (keine externe DB nötig). */

export type AnyProject = AnalysisProject | InspirationSearchProject

export function isSearchProject(p: AnyProject): p is InspirationSearchProject {
  return (p as InspirationSearchProject).mode === 'search'
}

export function saveProject(project: AnyProject): void {
  const path = join(storageDir(), `${project.id}.json`)
  writeFileSync(path, JSON.stringify(project, null, 2), 'utf-8')
  log.info('Projekt gespeichert:', path)
}

export interface ProjectSummary {
  id: string
  createdAt: string
  mode: 'url' | 'search'
  title: string
  subtitle?: string
  resultCount: number
  topScore: number
}

export function listProjects(): ProjectSummary[] {
  const dir = storageDir()
  const out: ProjectSummary[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    try {
      const p = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as AnyProject
      if (isSearchProject(p)) {
        out.push({
          id: p.id,
          createdAt: p.createdAt,
          mode: 'search',
          title: p.config.query || p.detected.industry || 'Inspiration-Suche',
          subtitle: [p.detected.industry, ...(p.detected.styles || [])].filter(Boolean).join(' · '),
          resultCount: p.results.length,
          topScore: p.results[0]?.score.total ?? 0
        })
      } else {
        out.push({
          id: p.id,
          createdAt: p.createdAt,
          mode: 'url',
          title: p.target.companyName || p.config.url,
          subtitle: p.target.industry,
          resultCount: p.competitors.length,
          topScore: p.competitors[0]?.score.total ?? 0
        })
      }
    } catch {
      /* defekte Datei überspringen */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function loadProject(id: string): AnyProject | null {
  const path = join(storageDir(), `${id}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as AnyProject
  } catch {
    return null
  }
}

export function deleteProject(id: string): boolean {
  const path = join(storageDir(), `${id}.json`)
  if (!existsSync(path)) return false
  unlinkSync(path)
  return true
}
