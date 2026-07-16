'use client'
import { useCallback, useEffect, useState } from 'react'
import { MailPlus, RefreshCw, ShieldCheck, Ban, UserCheck, XCircle, Trash2, Crown, Clock, Check } from 'lucide-react'
import { PageHeader, InfoBanner, EmptyState, SkeletonRows } from '@/components/ui/Ui'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { ROLE_LABELS, type Role } from '@shared/auth'
import { ALLOW_STATUS_LABELS, type AllowAction, type AuthorizedEmail } from '@shared/allowlist'

type Entry = AuthorizedEmail & { isProtectedOwner?: boolean }

interface Data {
  entries: Entry[]
  actor: { id: string; role: Role }
  assignableRoles: Role[]
  defaultRole: Role
}

const NEEDS_CONFIRM: Partial<Record<AllowAction, { title: string; body: (e: Entry) => string; danger?: boolean }>> = {
  revoke: { title: 'Freigabe widerrufen', body: (e) => `${e.email} verliert sofort jeden Zugriff und wird abgemeldet. Vorhandene Dateien bleiben erhalten und werden nicht gelöscht.`, danger: true },
  disable: { title: 'Zugang deaktivieren', body: (e) => `${e.email} wird sofort abgemeldet und kann sich nicht mehr anmelden. Die Daten bleiben erhalten.`, danger: true },
  suspend: { title: 'Vorübergehend sperren', body: (e) => `${e.email} wird sofort abgemeldet. Die Sperre lässt sich jederzeit wieder aufheben.` },
  delete: { title: 'Eintrag löschen', body: (e) => `Der Freigabeeintrag für ${e.email} wird entfernt. Ein bereits angelegter Benutzer bleibt bestehen — widerrufe die Freigabe, wenn der Zugriff enden soll.`, danger: true }
}

export default function AllowlistPage() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [pending, setPending] = useState<{ entry: Entry; action: AllowAction; role?: Role } | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch('/api/admin/allowlist')
      if (!r.ok) { setError('Die Freigabeliste konnte nicht geladen werden.'); return }
      setData(await r.json())
    } catch {
      setError('Die Freigabeliste konnte nicht geladen werden.')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (entry: Entry, action: AllowAction, role?: Role) => {
    setBusyId(entry.id); setError('')
    try {
      const r = await fetch(`/api/admin/allowlist/${entry.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, role })
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Die Aktion konnte nicht ausgeführt werden.'); return }
      await load()
    } finally { setBusyId('') }
  }

  const request = (entry: Entry, action: AllowAction, role?: Role) => {
    if (NEEDS_CONFIRM[action]) setPending({ entry, action, role })
    else run(entry, action, role)
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        eyebrow="Adminbereich"
        icon={ShieldCheck}
        title="Freigegebene E-Mail-Adressen"
        subtitle={data ? `${data.entries.length} Eintrag${data.entries.length === 1 ? '' : 'e'}` : 'Wird geladen …'}
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><RefreshCw size={14} /> Aktualisieren</button>
            <button onClick={() => setShowForm((s) => !s)} className="btn-ink flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><MailPlus size={14} /> Adresse freigeben</button>
          </div>
        }
      />

      <InfoBanner tone="gold">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          Es gibt keine öffentliche Registrierung. Nur Adressen aus dieser Liste dürfen sich anmelden — die bloße Existenz
          eines Google-Kontos genügt nie. Neue Freigaben starten bewusst mit der niedrigsten Rolle.
        </span>
      </InfoBanner>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && data && <InviteForm assignable={data.assignableRoles} defaultRole={data.defaultRole} onDone={() => { setShowForm(false); load() }} onError={setError} />}

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--color-line)]">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="sticky top-0 bg-[var(--color-surface)] text-left text-xs text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">E-Mail-Adresse</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Rolle</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Angemeldet</th>
              <th className="px-4 py-3 font-medium">Läuft ab</th>
              <th className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {!data && <tr><td colSpan={7} className="p-4"><SkeletonRows rows={4} /></td></tr>}
            {data?.entries.length === 0 && (
              <tr><td colSpan={7}><EmptyState icon={MailPlus} title="Noch keine Freigaben" description="Gib eine E-Mail-Adresse frei, damit sich diese Person mit Google anmelden kann." /></td></tr>
            )}
            {data?.entries.map((e) => (
              <Row key={e.id} e={e} assignable={data.assignableRoles} busy={busyId === e.id} onAction={request} />
            ))}
          </tbody>
        </table>
      </div>

      {pending && (
        <ConfirmDialog
          title={NEEDS_CONFIRM[pending.action]!.title}
          body={NEEDS_CONFIRM[pending.action]!.body(pending.entry)}
          danger={NEEDS_CONFIRM[pending.action]!.danger}
          confirmLabel={NEEDS_CONFIRM[pending.action]!.title}
          onCancel={() => setPending(null)}
          onConfirm={() => { const p = pending; setPending(null); run(p.entry, p.action, p.role) }}
        />
      )}
    </div>
  )
}

function Row({ e, assignable, busy, onAction }: { e: Entry; assignable: Role[]; busy: boolean; onAction: (e: Entry, a: AllowAction, r?: Role) => void }) {
  const locked = !!e.isProtectedOwner
  const tone = e.status === 'active' || e.status === 'approved'
    ? 'bg-emerald-50 text-emerald-700'
    : e.status === 'invited'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700'

  return (
    <tr className="border-t border-[var(--color-line)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="truncate">{e.email}</span>
          {locked && <Crown size={13} className="shrink-0 text-[var(--color-gold)]" aria-label="Inhaber — geschützt" />}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{[e.firstName, e.lastName].filter(Boolean).join(' ') || '—'}</td>
      <td className="px-4 py-3">
        {!locked && assignable.includes(e.defaultRole) ? (
          <select value={e.defaultRole} disabled={busy} onChange={(ev) => onAction(e, 'setRole', ev.target.value as Role)} className="inp py-1.5 text-xs" aria-label={`Rolle für ${e.email}`}>
            {assignable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        ) : (
          <span className="text-xs">{ROLE_LABELS[e.defaultRole]}</span>
        )}
      </td>
      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{ALLOW_STATUS_LABELS[e.status]}</span></td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{e.hasSignedIn ? <Check size={14} className="text-emerald-600" /> : 'noch nicht'}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
        {e.expiresAt ? <span className="flex items-center gap-1"><Clock size={12} /> {new Date(e.expiresAt).toLocaleDateString('de-DE')}</span> : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {busy && <RefreshCw size={14} className="animate-spin text-[var(--color-muted)]" />}
          {locked ? (
            <span className="text-xs text-[var(--color-muted)]">Geschützt</span>
          ) : (
            <>
              {e.status !== 'active' && e.status !== 'approved' && <Act icon={UserCheck} label="Zugang aktivieren" onClick={() => onAction(e, 'reactivate')} />}
              {(e.status === 'active' || e.status === 'approved') && <Act icon={Ban} label="Vorübergehend sperren" onClick={() => onAction(e, 'suspend')} />}
              {e.status !== 'disabled' && <Act icon={XCircle} label="Deaktivieren" onClick={() => onAction(e, 'disable')} />}
              {e.status !== 'revoked' && <Act icon={Ban} label="Freigabe widerrufen" onClick={() => onAction(e, 'revoke')} danger />}
              <Act icon={Trash2} label="Eintrag löschen" onClick={() => onAction(e, 'delete')} danger />
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function Act({ icon: Icon, label, onClick, danger }: { icon: typeof Ban; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`rounded-lg p-2 transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]'}`}>
      <Icon size={15} />
    </button>
  )
}

function InviteForm({ assignable, defaultRole, onDone, onError }: { assignable: Role[]; defaultRole: Role; onDone: () => void; onError: (s: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', defaultRole, notes: '', expiresAt: '', activateImmediately: false })

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setBusy(true); onError('')
    try {
      const r = await fetch('/api/admin/allowlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, expiresAt: form.expiresAt || undefined })
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { onError(d?.error || 'Die Adresse konnte nicht freigegeben werden.'); return }
      onDone()
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="E-Mail-Adresse *">
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="inp" placeholder="name@beispiel.de" />
        </Field>
        <Field label="Vorname">
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="inp" />
        </Field>
        <Field label="Nachname">
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="inp" />
        </Field>
        <Field label="Anfängliche Rolle">
          <select value={form.defaultRole} onChange={(e) => setForm({ ...form, defaultRole: e.target.value as Role })} className="inp">
            {assignable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
        <Field label="Einladung läuft ab (optional)">
          <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="inp" />
        </Field>
        <Field label="Hinweis (optional)">
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="inp" placeholder="z. B. Praktikant, bis Ende März" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        <input type="checkbox" checked={form.activateImmediately} onChange={(e) => setForm({ ...form, activateImmediately: e.target.checked })} />
        Zugang sofort freigeben (sonst gilt der Eintrag erst als „eingeladen")
      </label>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--color-muted)]">
          Ein Einladungsversand per E-Mail ist noch nicht eingebaut — teile der Person den Zugang bitte selbst mit.
        </p>
        <button type="submit" disabled={busy || !form.email} className="btn-ink flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm">
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <MailPlus size={14} />} Freigeben
        </button>
      </div>
    </form>
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
