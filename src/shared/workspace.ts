/* ─────────────────────────  Workspace — Typen  ───────────────────────── */

/** Gelöschtes bleibt so lange im Papierkorb, bevor es endgültig entfernt werden darf. */
export const TRASH_RETENTION_DAYS = 30

export interface FolderNode {
  id: string
  parentId: string | null
  name: string
  createdBy?: string
  createdAt: string
  deletedAt?: string
}

export interface FileNode {
  id: string
  folderId: string | null
  name: string
  mime: string
  size: number
  version: number
  createdBy?: string
  createdAt: string
  updatedBy?: string
  updatedAt: string
  deletedAt?: string
}

export interface FileVersionNode {
  id: string
  fileId: string
  version: number
  size: number
  mime: string
  comment?: string
  createdBy?: string
  createdAt: string
}

/** Ein Eintrag im Pfad („Brotkrumen") vom Wurzelordner bis zum aktuellen Ordner. */
export interface Crumb {
  id: string | null
  name: string
}

export interface Listing {
  folder: Crumb
  crumbs: Crumb[]
  folders: FolderNode[]
  files: FileNode[]
}

/** Menschlich lesbare Größe. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** Grobe Kategorie für Icon und Vorschau. */
export type FileKind = 'image' | 'pdf' | 'text' | 'office' | 'archive' | 'other'

export function kindOf(mime: string, name: string): FileKind {
  if (mime.startsWith('image/') && !name.toLowerCase().endsWith('.svg')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('text/') || mime === 'application/json' || name.toLowerCase().endsWith('.svg')) return 'text'
  if (mime.includes('openxmlformats')) return 'office'
  if (mime === 'application/zip') return 'archive'
  return 'other'
}
