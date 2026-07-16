'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  FolderPlus, Upload, Folder, FileText, Image as ImageIcon, FileArchive, File as FileIcon,
  Trash2, Download, Pencil, History, ChevronRight, RefreshCw, HardDrive, RotateCcw, X
} from 'lucide-react'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui/Ui'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { formatBytes, kindOf, type Listing, type FileNode, type FolderNode, type FileVersionNode } from '@shared/workspace'

export default function WorkspacePage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceInner />
    </Suspense>
  )
}

function WorkspaceInner() {
  const router = useRouter()
  const params = useSearchParams()
  const folderId = params.get('folder') || 'root'

  const [data, setData] = useState<Listing | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [used, setUsed] = useState<number | null>(null)
  const [versionsFor, setVersionsFor] = useState<FileNode | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'file' | 'folder'; id: string; name: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`/api/workspace/files?folder=${encodeURIComponent(folderId)}`)
      const d = await r.json()
      if (!r.ok) { setError(d?.error || 'Der Ordner konnte nicht geladen werden.'); setData(null); return }
      setData(d)
    } catch {
      setError('Der Ordner konnte nicht geladen werden.')
    }
    try {
      const t = await (await fetch('/api/workspace/trash')).json()
      if (t.ok) setUsed(t.storageUsed)
    } catch { /* Belegung ist Beiwerk — kein Grund für eine Fehlermeldung. */ }
  }, [folderId])

  useEffect(() => { load() }, [load])

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    setBusy(true); setError('')
    const fd = new FormData()
    fd.append('folder', folderId)
    for (const f of list) fd.append('file', f)
    try {
      const r = await fetch('/api/workspace/files', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.rejected?.length) {
        setError(d.rejected.map((x: { name: string; error: string }) => `${x.name}: ${x.error}`).join('  ·  '))
      }
      await load()
    } catch {
      setError('Der Upload ist fehlgeschlagen.')
    } finally { setBusy(false) }
  }

  const act = async (kind: 'file' | 'folder', id: string, body: Record<string, unknown>) => {
    setBusy(true); setError('')
    try {
      const r = await fetch(`/api/workspace/${kind === 'file' ? 'files' : 'folders'}/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Die Aktion konnte nicht ausgeführt werden.'); return }
      await load()
    } catch {
      setError('Die Aktion konnte nicht ausgeführt werden.')
    } finally { setBusy(false) }
  }

  const newFolder = async () => {
    const name = window.prompt('Name des neuen Ordners')
    if (!name?.trim()) return
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/workspace/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, parentId: folderId === 'root' ? null : folderId })
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Der Ordner konnte nicht angelegt werden.'); return }
      await load()
    } finally { setBusy(false) }
  }

  const rename = (kind: 'file' | 'folder', id: string, current: string) => {
    const name = window.prompt('Neuer Name', current)
    if (!name?.trim() || name === current) return
    act(kind, id, { action: 'rename', name })
  }

  const goTo = (id: string | null) => router.push(id ? `/workspace?folder=${id}` : '/workspace')

  return (
    <div
      className="mx-auto w-full max-w-[1440px]"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files) }}
    >
      <PageHeader
        eyebrow="Workspace"
        icon={HardDrive}
        title="Dateien"
        subtitle={used != null ? `${formatBytes(used)} belegt` : 'Wird geladen …'}
        action={
          <div className="flex items-center gap-2">
            <button onClick={newFolder} disabled={busy} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <FolderPlus size={14} /> Neuer Ordner
            </button>
            <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-ink flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />} Hochladen
            </button>
          </div>
        }
      />
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />

      {/* Brotkrumen */}
      <nav aria-label="Pfad" className="mt-4 flex flex-wrap items-center gap-1 text-sm text-[var(--color-muted)]">
        {data?.crumbs.map((c, i) => (
          <span key={c.id || 'root'} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={13} className="opacity-50" />}
            <button
              onClick={() => goTo(c.id)}
              disabled={i === data.crumbs.length - 1}
              className={i === data.crumbs.length - 1 ? 'font-medium text-[var(--color-ink)]' : 'hover:text-[var(--color-ink)] hover:underline'}
            >
              {c.name}
            </button>
          </span>
        ))}
      </nav>

      {error && (
        <p className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Meldung schließen"><X size={14} /></button>
        </p>
      )}

      <div className={`mt-4 rounded-xl border-2 border-dashed transition-colors ${dragOver ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5' : 'border-transparent'}`}>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="sticky top-0 bg-[var(--color-surface)] text-left text-xs text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Größe</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Geändert</th>
                <th className="px-4 py-3 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {!data && <tr><td colSpan={5} className="p-4"><SkeletonRows rows={4} /></td></tr>}
              {data && data.folders.length === 0 && data.files.length === 0 && (
                <tr><td colSpan={5}>
                  <EmptyState icon={Folder} title="Dieser Ordner ist leer" description="Zieh Dateien hierher oder nutze „Hochladen“." />
                </td></tr>
              )}
              {data?.folders.map((f) => (
                <FolderRow key={f.id} f={f} onOpen={() => goTo(f.id)} onRename={() => rename('folder', f.id, f.name)} onTrash={() => setConfirm({ kind: 'folder', id: f.id, name: f.name })} />
              ))}
              {data?.files.map((f) => (
                <FileRow key={f.id} f={f} onRename={() => rename('file', f.id, f.name)} onTrash={() => setConfirm({ kind: 'file', id: f.id, name: f.name })} onVersions={() => setVersionsFor(f)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--color-muted)]">
        Gelöschtes landet im Papierkorb und bleibt dort 30 Tage. Endgültig löschen dürfen nur Administratoren.
      </p>

      {versionsFor && <VersionsPanel file={versionsFor} onClose={() => setVersionsFor(null)} onRestored={() => { setVersionsFor(null); load() }} />}

      {confirm && (
        <ConfirmDialog
          title="In den Papierkorb verschieben"
          body={`„${confirm.name}“ wird in den Papierkorb verschoben und ist dort 30 Tage lang wiederherstellbar.`}
          confirmLabel="In den Papierkorb"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); act(c.kind, c.id, { action: 'trash' }) }}
        />
      )}
    </div>
  )
}

function FolderRow({ f, onOpen, onRename, onTrash }: { f: FolderNode; onOpen: () => void; onRename: () => void; onTrash: () => void }) {
  return (
    <tr className="border-t border-[var(--color-line)] hover:bg-[var(--color-hover)]">
      <td className="px-4 py-3">
        <button onClick={onOpen} className="flex items-center gap-2.5 text-left font-medium hover:underline">
          <Folder size={16} className="shrink-0 text-[var(--color-gold)]" /> {f.name}
        </button>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">—</td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">—</td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{fmt(f.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Act icon={Pencil} label="Umbenennen" onClick={onRename} />
          <Act icon={Trash2} label="In den Papierkorb" onClick={onTrash} danger />
        </div>
      </td>
    </tr>
  )
}

function FileRow({ f, onRename, onTrash, onVersions }: { f: FileNode; onRename: () => void; onTrash: () => void; onVersions: () => void }) {
  const kind = kindOf(f.mime, f.name)
  const Icon = kind === 'image' ? ImageIcon : kind === 'archive' ? FileArchive : kind === 'other' ? FileIcon : FileText
  return (
    <tr className="border-t border-[var(--color-line)] hover:bg-[var(--color-hover)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="shrink-0 text-[var(--color-muted)]" />
          <span className="truncate">{f.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-[var(--color-muted)]">{formatBytes(f.size)}</td>
      <td className="px-4 py-3 text-xs tabular-nums text-[var(--color-muted)]">
        {f.version > 1 ? <button onClick={onVersions} className="hover:underline">v{f.version}</button> : `v${f.version}`}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{fmt(f.updatedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <a href={`/api/workspace/files/${f.id}`} download className="rounded-lg p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]" title="Herunterladen" aria-label={`${f.name} herunterladen`}>
            <Download size={15} />
          </a>
          <Act icon={History} label="Versionen" onClick={onVersions} />
          <Act icon={Pencil} label="Umbenennen" onClick={onRename} />
          <Act icon={Trash2} label="In den Papierkorb" onClick={onTrash} danger />
        </div>
      </td>
    </tr>
  )
}

function Act({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]'}`}
    >
      <Icon size={15} />
    </button>
  )
}

function VersionsPanel({ file, onClose, onRestored }: { file: FileNode; onClose: () => void; onRestored: () => void }) {
  const [versions, setVersions] = useState<FileVersionNode[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/workspace/files/${file.id}/versions`).then((r) => r.json()).then((d) => setVersions(d.versions || [])).catch(() => setVersions([]))
  }, [file.id])

  const restore = async (version: number) => {
    setBusy(true)
    try {
      await fetch(`/api/workspace/files/${file.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'restoreVersion', version })
      })
      onRestored()
    } finally { setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl">{file.name}</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Versionsverlauf</p>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"><X size={16} /></button>
        </div>

        <div className="mt-5 max-h-[50vh] space-y-2 overflow-y-auto">
          {!versions && <SkeletonRows rows={3} />}
          {versions?.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">v{v.version} {v.version === file.version && <span className="text-xs font-normal text-[var(--color-gold)]">aktuell</span>}</div>
                <div className="truncate text-xs text-[var(--color-muted)]">{formatBytes(v.size)} · {fmt(v.createdAt)}{v.comment ? ` · ${v.comment}` : ''}</div>
              </div>
              {v.version !== file.version && (
                <button onClick={() => restore(v.version)} disabled={busy} className="btn-ghost flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
                  <RotateCcw size={12} /> Wiederherstellen
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Wiederherstellen überschreibt die Historie nicht, sondern legt die alte Fassung als neue Version an.
        </p>
      </div>
    </div>
  )
}

function fmt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
