'use client'
import { useState } from 'react'
import { X, RefreshCw } from 'lucide-react'
import {
  PROJECT_KIND_LABELS, PROJECT_STATUS_LABELS, PROJECT_PRIORITY_LABELS, PROJECT_VISIBILITY_LABELS,
  type Project, type ProjectKind, type ProjectPriority, type ProjectStatus, type ProjectVisibility
} from '@shared/projects'

/**
 * Anlage- und Bearbeitungsdialog für Projekte.
 * Mobil: Vollhöhe-scrollbar (overflow-y-auto), Felder untereinander, Touch-Ziele ≥ 36–44px.
 */
export function ProjectEditor({ project, users, companies, meId, onClose, onCreated, onSaved }: {
  project?: Project
  users: { id: string; name?: string; email: string }[]
  companies: { id: string; name: string }[]
  meId: string
  onClose: () => void
  onCreated?: (id: string) => void
  onSaved?: () => void
}) {
  const [f, setF] = useState({
    name: project?.name || '',
    description: project?.description || '',
    kind: project?.kind || ('website' as ProjectKind),
    status: project?.status || ('geplant' as ProjectStatus),
    priority: project?.priority || ('normal' as ProjectPriority),
    visibility: project?.visibility || ('team' as ProjectVisibility),
    companyId: project?.companyId || '',
    leadId: project?.leadId || meId,
    dueDate: project?.dueDate || '',
    withChat: true,
    withFolder: true
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (busy) return
    if (!f.name.trim()) { setError('Das Projekt braucht einen Namen.'); return }
    setBusy(true); setError('')
    const payload = { ...f, companyId: f.companyId || null, dueDate: f.dueDate || null, leadId: f.leadId || null }
    try {
      const r = project
        ? await fetch(`/api/workspace/projects/${project.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', ...payload }) })
        : await fetch('/api/workspace/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Speichern nicht möglich.'); setBusy(false); return }
      if (project) onSaved?.()
      else onCreated?.(d.project.id)
    } catch {
      setError('Speichern nicht möglich.')
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:py-10" onClick={onClose}>
      <div className="card w-full max-w-2xl p-5 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl">{project ? 'Projekt bearbeiten' : 'Neues Projekt'}</h2>
          <button onClick={onClose} aria-label="Schließen" className="flex h-10 w-10 items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Projektname *">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus className="inp" placeholder="z. B. Website Müller GmbH" />
          </Field>
          <Field label="Beschreibung">
            <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className="inp resize-y" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Art">
              <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ProjectKind })} className="inp">
                {(Object.keys(PROJECT_KIND_LABELS) as ProjectKind[]).map((k) => <option key={k} value={k}>{PROJECT_KIND_LABELS[k]}</option>)}
              </select>
            </Field>
            <Field label="Kunde">
              <select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })} className="inp">
                <option value="">Kein Kunde</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Projektleitung">
              <select value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value })} className="inp">
                {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}{u.id === meId ? ' (ich)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Fällig am">
              <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className="inp" />
            </Field>
            <Field label="Status">
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectStatus })} className="inp">
                {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Priorität">
              <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as ProjectPriority })} className="inp">
                {(Object.keys(PROJECT_PRIORITY_LABELS) as ProjectPriority[]).map((p) => <option key={p} value={p}>{PROJECT_PRIORITY_LABELS[p]}</option>)}
              </select>
            </Field>
            <Field label="Sichtbarkeit">
              <select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value as ProjectVisibility })} className="inp">
                {(Object.keys(PROJECT_VISIBILITY_LABELS) as ProjectVisibility[]).map((v) => <option key={v} value={v}>{PROJECT_VISIBILITY_LABELS[v]}</option>)}
              </select>
            </Field>
          </div>

          {!project && (
            <div className="rounded-lg border border-[var(--color-line)] p-3">
              <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">Beim Anlegen automatisch erstellen:</p>
              <label className="flex min-h-[36px] items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <input type="checkbox" checked={f.withChat} onChange={(e) => setF({ ...f, withChat: e.target.checked })} /> Projektchat
              </label>
              <label className="flex min-h-[36px] items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <input type="checkbox" checked={f.withFolder} onChange={(e) => setF({ ...f, withFolder: e.target.checked })} /> Projektordner in der Ablage
              </label>
            </div>
          )}
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--color-line)] pt-4">
          <button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">Abbrechen</button>
          <button onClick={save} disabled={busy || !f.name.trim()} className="btn-ink flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
            {busy && <RefreshCw size={13} className="animate-spin" />} {project ? 'Speichern' : 'Projekt anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  )
}
