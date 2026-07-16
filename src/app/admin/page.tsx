'use client'
import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Users, RefreshCw, Ban, UserCheck, UserX, LogOut, Trash2, Crown, Lock } from 'lucide-react'
import { PageHeader, InfoBanner, EmptyState, SkeletonRows } from '@/components/ui/Ui'
import { ROLE_LABELS, USER_STATUS_LABELS, type Role, type UserAction } from '@shared/auth'
import { PASSWORD_STATE_LABELS, type AdminUserRow } from '@shared/admin'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'

interface Data {
  users: AdminUserRow[]
  actor: { id: string; role: Role }
  assignableRoles: Role[]
  ownerConfigured: boolean
}

/** Aktionen, die vor der Ausführung eine ausdrückliche Bestätigung verlangen. */
const NEEDS_CONFIRM: Record<string, { title: string; body: (u: AdminUserRow) => string; danger?: boolean }> = {
  deactivate: { title: 'Benutzer deaktivieren', body: (u) => `${u.email} wird sofort abgemeldet und verliert jeden Zugriff auf Daten, Dateien und APIs. Die Sperre greift augenblicklich, nicht erst beim nächsten Seitenaufruf.`, danger: true },
  block: { title: 'Benutzer sperren', body: (u) => `${u.email} wird sofort abgemeldet und kann sich vorübergehend nicht mehr anmelden.`, danger: true },
  revokeSessions: { title: 'Alle Sitzungen beenden', body: (u) => `Alle offenen Sitzungen von ${u.email} werden sofort ungültig. Die Person muss sich neu anmelden.` },
  delete: { title: 'Benutzer endgültig löschen', body: (u) => `${u.email} wird unwiderruflich gelöscht. Dieser Schritt lässt sich nicht rückgängig machen.`, danger: true },
  setRole: { title: 'Rolle ändern', body: (u) => `Die Rolle von ${u.email} wird geändert. Alle offenen Sitzungen werden dabei beendet, damit die neue Rolle sofort gilt.` }
}

export default function AdminPage() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [pending, setPending] = useState<{ user: AdminUserRow; action: UserAction; role?: Role } | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch('/api/admin/users')
      if (!r.ok) { setError('Die Benutzerliste konnte nicht geladen werden.'); return }
      setData(await r.json())
    } catch {
      setError('Die Benutzerliste konnte nicht geladen werden.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const run = async (user: AdminUserRow, action: UserAction, role?: Role) => {
    setBusyId(user.id); setError('')
    try {
      const r = await fetch(`/api/admin/users/${user.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, role })
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setError(d?.error || 'Die Aktion konnte nicht ausgeführt werden.'); return }
      await load()
    } catch {
      setError('Die Aktion konnte nicht ausgeführt werden.')
    } finally { setBusyId('') }
  }

  const request = (user: AdminUserRow, action: UserAction, role?: Role) => {
    if (NEEDS_CONFIRM[action]) setPending({ user, action, role })
    else run(user, action, role)
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        eyebrow="Adminbereich"
        icon={ShieldCheck}
        title="Benutzerverwaltung"
        subtitle={data ? `${data.users.length} Konto${data.users.length === 1 ? '' : 'en'}` : 'Wird geladen …'}
        action={
          <button onClick={load} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <RefreshCw size={14} /> Aktualisieren
          </button>
        }
      />

      <InfoBanner tone="gold">
        <Lock size={14} className="mt-0.5 shrink-0" />
        <span>
          Passwörter werden nirgends angezeigt und existieren beim Google-Login gar nicht — es gibt kein lokales Benutzerpasswort.
          Die Inhaber-Rolle wird ausschließlich über die Umgebungsvariable <code>OWNER_EMAILS</code> vergeben und lässt sich hier nicht ändern.
        </span>
      </InfoBanner>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--color-line)]">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 bg-[var(--color-surface)] text-left text-xs text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Benutzer</th>
              <th className="px-4 py-3 font-medium">Rolle</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Anmeldung</th>
              <th className="px-4 py-3 font-medium">Letzter Login</th>
              <th className="px-4 py-3 font-medium">Letzte Aktivität</th>
              <th className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {!data && <tr><td colSpan={7} className="p-4"><SkeletonRows rows={4} /></td></tr>}
            {data?.users.length === 0 && (
              <tr><td colSpan={7}><EmptyState icon={Users} title="Keine Konten" description="Sobald sich jemand über die Freigabeliste anmeldet, erscheint er hier." /></td></tr>
            )}
            {data?.users.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                assignable={data.assignableRoles}
                busy={busyId === u.id}
                onAction={request}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pending && (
        <ConfirmDialog
          title={NEEDS_CONFIRM[pending.action].title}
          body={NEEDS_CONFIRM[pending.action].body(pending.user)}
          danger={NEEDS_CONFIRM[pending.action].danger}
          confirmLabel={NEEDS_CONFIRM[pending.action].title}
          onCancel={() => setPending(null)}
          onConfirm={() => { const p = pending; setPending(null); run(p.user, p.action, p.role) }}
        />
      )}
    </div>
  )
}

function UserRow({ u, assignable, busy, onAction }: { u: AdminUserRow; assignable: Role[]; busy: boolean; onAction: (u: AdminUserRow, a: UserAction, r?: Role) => void }) {
  const can = (a: UserAction) => u.allowedActions.includes(a)
  return (
    <tr className="border-t border-[var(--color-line)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {u.picture
            ? <img src={u.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
            : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-paper-2)] text-xs">{(u.name || u.email)[0]?.toUpperCase()}</div>}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-medium">
              {u.name || u.email.split('@')[0]}
              {u.isProtectedOwner && <Crown size={13} className="shrink-0 text-[var(--color-gold)]" aria-label="Inhaber — geschützt" />}
              {u.isSelf && <span className="text-xs text-[var(--color-muted)]">(du)</span>}
            </div>
            <div className="truncate text-xs text-[var(--color-muted)]">{u.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {can('setRole') && assignable.length > 0 ? (
          <select
            value={u.role}
            disabled={busy}
            onChange={(e) => onAction(u, 'setRole', e.target.value as Role)}
            className="inp py-1.5 text-xs"
            aria-label={`Rolle von ${u.email}`}
          >
            {!assignable.includes(u.role) && <option value={u.role}>{ROLE_LABELS[u.role]}</option>}
            {assignable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        ) : (
          <span className="text-xs">{ROLE_LABELS[u.role]}</span>
        )}
      </td>
      <td className="px-4 py-3"><StatusPill status={u.status} /></td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{PASSWORD_STATE_LABELS[u.passwordState]}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{fmt(u.lastLoginAt)}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{fmt(u.lastActivityAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {busy && <RefreshCw size={14} className="animate-spin text-[var(--color-muted)]" />}
          {u.isProtectedOwner && !u.isSelf && <span className="text-xs text-[var(--color-muted)]">Geschützt</span>}
          {can('unblock') && u.status !== 'active' && <IconBtn icon={UserCheck} label="Entsperren" onClick={() => onAction(u, 'unblock')} />}
          {can('block') && u.status === 'active' && <IconBtn icon={Ban} label="Sperren" onClick={() => onAction(u, 'block')} />}
          {can('deactivate') && u.status !== 'deactivated' && <IconBtn icon={UserX} label="Deaktivieren" onClick={() => onAction(u, 'deactivate')} />}
          {can('revokeSessions') && <IconBtn icon={LogOut} label="Alle Sitzungen beenden" onClick={() => onAction(u, 'revokeSessions')} />}
          {can('delete') && <IconBtn icon={Trash2} label="Löschen" danger onClick={() => onAction(u, 'delete')} />}
        </div>
      </td>
    </tr>
  )
}

function IconBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Ban; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 transition-colors hover:bg-[var(--color-paper-2)] ${danger ? 'text-red-600 hover:bg-red-50' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
    >
      <Icon size={15} />
    </button>
  )
}

function StatusPill({ status }: { status: AdminUserRow['status'] }) {
  const tone = status === 'active'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'invited'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{USER_STATUS_LABELS[status]}</span>
}

function fmt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
