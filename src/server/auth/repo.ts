import { randomUUID } from 'crypto'
import type { AppUser, Role, UserStatus } from '@shared/auth'
import { getDb } from '../services/kundenfinder/db'
import { initialRoleFor } from './config'

const now = () => new Date().toISOString()
const norm = (e: string) => e.trim().toLowerCase()

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToUser(r: any): AppUser {
  return {
    id: r.id,
    googleSub: r.google_sub || undefined,
    email: r.email,
    emailVerified: !!r.email_verified,
    name: r.name || undefined,
    picture: r.picture || undefined,
    role: (r.role || 'member') as Role,
    status: (r.status || 'invited') as UserStatus,
    tokenVersion: r.token_version ?? 0,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at || undefined,
    lastActivityAt: r.last_activity_at || undefined,
    approvedBy: r.approved_by || undefined,
    approvedAt: r.approved_at || undefined
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function getUserById(id: string): AppUser | null {
  const r = getDb().prepare('SELECT * FROM app_users WHERE id = ?').get(id)
  return r ? rowToUser(r) : null
}
export function getUserByEmail(email: string): AppUser | null {
  const r = getDb().prepare('SELECT * FROM app_users WHERE email_norm = ?').get(norm(email))
  return r ? rowToUser(r) : null
}
export function listUsers(): AppUser[] {
  return getDb().prepare('SELECT * FROM app_users ORDER BY created_at DESC').all().map(rowToUser)
}

/**
 * Legt einen freigegebenen Google-Benutzer beim ersten Login an oder aktualisiert Profil/Login.
 * Rolle/Status werden bei Folge-Logins NICHT überschrieben (Admin-Entscheidungen bleiben erhalten).
 * Wird ausschließlich aufgerufen, nachdem die Allowlist serverseitig bestätigt wurde.
 */
export function upsertGoogleUser(p: { sub: string; email: string; emailVerified: boolean; name?: string; picture?: string }): AppUser {
  const db = getDb()
  const t = now()
  const existing = getUserByEmail(p.email)
  if (existing) {
    db.prepare('UPDATE app_users SET google_sub=?, name=COALESCE(?,name), picture=?, email_verified=?, last_login_at=?, last_activity_at=? WHERE id=?')
      .run(p.sub, p.name || null, p.picture || null, p.emailVerified ? 1 : 0, t, t, existing.id)
    return getUserById(existing.id)!
  }
  const id = randomUUID()
  const role = initialRoleFor(p.email)
  db.prepare(
    `INSERT INTO app_users (id,google_sub,email,email_norm,email_verified,name,picture,role,status,token_version,created_at,last_login_at,last_activity_at,approved_by,approved_at)
     VALUES (?,?,?,?,?,?,?,?,'active',0,?,?,?,?,?)`
  ).run(id, p.sub, p.email, norm(p.email), p.emailVerified ? 1 : 0, p.name || null, p.picture || null, role, t, t, t, 'allowlist', t)
  return getUserById(id)!
}

export function setUserStatus(id: string, status: UserStatus, by: string): AppUser | null {
  const db = getDb()
  db.prepare('UPDATE app_users SET status=? WHERE id=?').run(status, id)
  // Sperren/Deaktivieren/Widerruf beendet sofort alle bestehenden Sessions.
  if (status === 'blocked' || status === 'deactivated' || status === 'revoked') bumpTokenVersion(id)
  return getUserById(id)
}
export function setUserRole(id: string, role: Role): AppUser | null {
  getDb().prepare('UPDATE app_users SET role=? WHERE id=?').run(role, id)
  return getUserById(id)
}
/** Erhöht die Token-Version → alle bestehenden Sessions des Benutzers werden ungültig. */
export function bumpTokenVersion(id: string): void {
  getDb().prepare('UPDATE app_users SET token_version = token_version + 1 WHERE id=?').run(id)
}
export function touchActivity(id: string): void {
  getDb().prepare('UPDATE app_users SET last_activity_at=? WHERE id=?').run(now(), id)
}

/* ── Zweite Sicherheitsfreigabe (Passwort) ── */
export interface PasswordRow {
  passwordHash: string | null
  passwordVersion: number
  gateEpoch: number
  isActive: boolean
  isDevelopmentPassword: boolean
  createdAt?: string
  activatedAt?: string
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export function getPasswordRow(): PasswordRow {
  const r = getDb().prepare('SELECT * FROM security_access_password WHERE id = 1').get() as any
  return {
    passwordHash: r?.password_hash ?? null,
    passwordVersion: r?.password_version ?? 1,
    gateEpoch: r?.gate_epoch ?? 1,
    isActive: !!r?.is_active,
    isDevelopmentPassword: !!r?.is_development_password,
    createdAt: r?.created_at || undefined,
    activatedAt: r?.activated_at || undefined
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Setzt einen neuen (bereits gehashten) Zugangspasswort-Hash; erhöht Version und widerruft alle Freigaben. */
export function setGatePassword(hash: string, opts: { isDev: boolean; changedBy?: string }): void {
  getDb()
    .prepare('UPDATE security_access_password SET password_hash=?, password_version = password_version + 1, gate_epoch = gate_epoch + 1, is_active=1, is_development_password=?, created_at=COALESCE(created_at,?), activated_at=?, changed_by_user_id=? WHERE id=1')
    .run(hash, opts.isDev ? 1 : 0, now(), now(), opts.changedBy || null)
}
/** Widerruft alle zweiten Freigaben (ohne Passwortänderung). */
export function bumpGateEpoch(): void {
  getDb().prepare('UPDATE security_access_password SET gate_epoch = gate_epoch + 1 WHERE id=1').run()
}

/* ── Audit-Log ── */
export function audit(action: string, opts: { userId?: string; email?: string; resource?: string; success?: boolean; ipHash?: string; meta?: Record<string, unknown> } = {}): void {
  try {
    getDb()
      .prepare('INSERT INTO auth_audit_log (at,user_id,email,action,resource,success,ip_hash,meta) VALUES (?,?,?,?,?,?,?,?)')
      .run(now(), opts.userId || null, opts.email || null, action, opts.resource || null, opts.success === false ? 0 : 1, opts.ipHash || null, opts.meta ? JSON.stringify(opts.meta) : null)
  } catch {
    // Audit darf den Hauptfluss nie blockieren.
  }
}
export function listAudit(limit = 200) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return getDb().prepare('SELECT at,user_id as userId,email,action,resource,success,meta FROM auth_audit_log ORDER BY id DESC LIMIT ?').all(limit).map((r: any) => ({
    at: r.at, userId: r.userId || undefined, email: r.email || undefined, action: r.action, resource: r.resource || undefined, success: !!r.success, meta: r.meta ? JSON.parse(r.meta) : undefined
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
