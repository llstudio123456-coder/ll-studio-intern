import { randomUUID } from 'crypto'
import { getDb } from '../services/kundenfinder/db'
import { normalizeEmail, isExpired, LOGIN_ALLOWED_STATUSES, type AllowStatus, type AuthorizedEmail } from '@shared/allowlist'
import type { Role } from '@shared/auth'

const now = () => new Date().toISOString()

/* eslint-disable @typescript-eslint/no-explicit-any */
const toRow = (r: any): AuthorizedEmail => ({
  id: r.id,
  email: r.email,
  status: r.status as AllowStatus,
  defaultRole: r.default_role as Role,
  firstName: r.first_name || undefined,
  lastName: r.last_name || undefined,
  notes: r.notes || undefined,
  invitedBy: r.invited_by || undefined,
  invitedAt: r.invited_at,
  approvedBy: r.approved_by || undefined,
  approvedAt: r.approved_at || undefined,
  expiresAt: r.expires_at || undefined,
  revokedAt: r.revoked_at || undefined,
  revokedBy: r.revoked_by || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export function findByEmail(email: string): AuthorizedEmail | null {
  const r = getDb().prepare('SELECT * FROM authorized_emails WHERE normalized_email = ?').get(normalizeEmail(email))
  return r ? toRow(r) : null
}

export function getEntry(id: string): AuthorizedEmail | null {
  const r = getDb().prepare('SELECT * FROM authorized_emails WHERE id = ?').get(id)
  return r ? toRow(r) : null
}

/** Liste inklusive „hat sich schon angemeldet?" — die Oberfläche unterscheidet das. */
export function listEntries(): AuthorizedEmail[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM authorized_emails ORDER BY created_at DESC').all().map(toRow)
  for (const e of rows) {
    const u = db.prepare('SELECT 1 FROM app_users WHERE email_norm = ?').get(e.email.trim().toLowerCase())
    e.hasSignedIn = !!u
  }
  return rows
}

export function createEntry(p: {
  email: string
  defaultRole: Role
  firstName?: string
  lastName?: string
  notes?: string
  expiresAt?: string
  status?: AllowStatus
  invitedBy: string | null
}): AuthorizedEmail {
  const id = randomUUID()
  const t = now()
  getDb()
    .prepare(
      `INSERT INTO authorized_emails
       (id,email,normalized_email,status,default_role,first_name,last_name,notes,invited_by,invited_at,expires_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      id,
      p.email.trim(),
      normalizeEmail(p.email),
      p.status || 'invited',
      p.defaultRole,
      p.firstName || null,
      p.lastName || null,
      p.notes || null,
      p.invitedBy,
      t,
      p.expiresAt || null,
      t,
      t
    )
  return getEntry(id)!
}

export function setStatus(id: string, status: AllowStatus, by: string | null): AuthorizedEmail | null {
  const db = getDb()
  const t = now()
  if (status === 'revoked') {
    db.prepare('UPDATE authorized_emails SET status=?, revoked_at=?, revoked_by=?, updated_at=? WHERE id=?').run(status, t, by, t, id)
  } else if (status === 'active' || status === 'approved') {
    // Reaktivieren hebt einen früheren Widerruf auf — sonst bliebe der Eintrag optisch
    // widerrufen, obwohl er wieder gilt.
    db.prepare('UPDATE authorized_emails SET status=?, approved_by=?, approved_at=?, revoked_at=NULL, revoked_by=NULL, updated_at=? WHERE id=?')
      .run(status, by, t, t, id)
  } else {
    db.prepare('UPDATE authorized_emails SET status=?, updated_at=? WHERE id=?').run(status, t, id)
  }
  return getEntry(id)
}

export function setDefaultRole(id: string, role: Role): AuthorizedEmail | null {
  getDb().prepare('UPDATE authorized_emails SET default_role=?, updated_at=? WHERE id=?').run(role, now(), id)
  return getEntry(id)
}

export function deleteEntry(id: string): void {
  getDb().prepare('DELETE FROM authorized_emails WHERE id=?').run(id)
}

/** Beim ersten Login: Eintrag von „eingeladen" auf „aktiv" heben. */
export function markSignedIn(email: string): void {
  const e = findByEmail(email)
  if (!e) return
  if (e.status === 'invited' || e.status === 'approved') {
    getDb().prepare("UPDATE authorized_emails SET status='active', updated_at=? WHERE id=?").run(now(), e.id)
  }
}

export interface AllowDecision {
  allowed: boolean
  /** Nur für das Audit-Log — dem Benutzer wird stets dieselbe neutrale Meldung gezeigt. */
  reason: string
  role?: Role
}

/**
 * Autoritative Entscheidung, ob sich eine Adresse anmelden darf. Default-Deny.
 *
 * Reihenfolge: Ein abgelaufener oder widerrufener Eintrag schlägt jede Env-Freigabe — sonst
 * könnte ein Widerruf über die Umgebung ausgehebelt werden. Die Env dient nur als Notzugang
 * für Inhaber und als Startpunkt, solange die Liste noch leer ist.
 */
export function decideAccess(email: string, envAllowed: boolean, isOwner: boolean): AllowDecision {
  const entry = findByEmail(email)

  if (entry) {
    if (entry.status === 'revoked') return { allowed: false, reason: 'Freigabe widerrufen' }
    if (entry.status === 'disabled') return { allowed: false, reason: 'Zugang deaktiviert' }
    if (entry.status === 'suspended') return { allowed: false, reason: 'Zugang vorübergehend gesperrt' }
    if (entry.status === 'expired' || isExpired(entry)) {
      // Ablauf einmalig festschreiben, damit die Liste den echten Zustand zeigt.
      if (entry.status !== 'expired') setStatus(entry.id, 'expired', null)
      // Der Inhaber darf nicht an einem Ablaufdatum scheitern.
      if (isOwner) return { allowed: true, reason: 'Inhaber (Ablauf ignoriert)', role: 'owner' }
      return { allowed: false, reason: 'Einladung abgelaufen' }
    }
    if (!LOGIN_ALLOWED_STATUSES.includes(entry.status)) return { allowed: false, reason: `Status ${entry.status}` }
    return { allowed: true, reason: 'Freigabeliste', role: isOwner ? 'owner' : entry.defaultRole }
  }

  // Kein Listeneintrag: nur noch Inhaber und die Env-Allowlist (Notzugang / Erststart).
  if (isOwner) return { allowed: true, reason: 'Inhaber über OWNER_EMAILS', role: 'owner' }
  if (envAllowed) return { allowed: true, reason: 'ALLOWED_GOOGLE_EMAILS' }
  return { allowed: false, reason: 'Nicht freigegeben' }
}

/**
 * Sorgt dafür, dass eine über die Env zugelassene Adresse auch in der Liste auftaucht.
 * Ohne das wäre der Inhaber im Adminbereich unsichtbar, und die Liste würde lügen.
 */
export function ensureEntryForEnv(email: string, role: Role): void {
  if (findByEmail(email)) return
  createEntry({
    email,
    defaultRole: role,
    status: 'active',
    notes: 'Automatisch aus der Umgebungskonfiguration übernommen.',
    invitedBy: null
  })
}
