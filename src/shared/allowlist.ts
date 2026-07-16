/* ─────────────────────────  E-Mail-Freigabeliste — Typen  ───────────────────────── */

import type { Role } from './auth'

export type AllowStatus = 'invited' | 'approved' | 'active' | 'suspended' | 'disabled' | 'revoked' | 'expired'

export const ALLOW_STATUS_LABELS: Record<AllowStatus, string> = {
  invited: 'Eingeladen',
  approved: 'Freigegeben',
  active: 'Aktiv',
  suspended: 'Vorübergehend gesperrt',
  disabled: 'Deaktiviert',
  revoked: 'Widerrufen',
  expired: 'Abgelaufen'
}

/**
 * Status, mit denen eine Anmeldung möglich ist.
 * Alles andere ist Default-Deny — auch ein unbekannter Status aus einer künftigen Version.
 */
export const LOGIN_ALLOWED_STATUSES: AllowStatus[] = ['invited', 'approved', 'active']

export interface AuthorizedEmail {
  id: string
  email: string
  status: AllowStatus
  defaultRole: Role
  firstName?: string
  lastName?: string
  notes?: string
  invitedBy?: string
  invitedAt: string
  approvedBy?: string
  approvedAt?: string
  expiresAt?: string
  revokedAt?: string
  revokedBy?: string
  createdAt: string
  updatedAt: string
  /** Hat sich unter dieser Adresse schon jemand angemeldet? (aus app_users ermittelt) */
  hasSignedIn?: boolean
  /** Aus OWNER_EMAILS/ALLOWED_GOOGLE_EMAILS statt aus der Liste — nicht widerrufbar. */
  fromEnv?: boolean
}

/**
 * Normalisierung für den eindeutigen Vergleich.
 * Gmail ignoriert Punkte im lokalen Teil und alles ab „+“ — „Max.Muster+job@gmail.com“ und
 * „maxmuster@gmail.com“ sind dasselbe Postfach. Ohne diese Regel könnte jemand eine widerrufene
 * Freigabe mit einer Schreibvariante derselben Adresse umgehen.
 */
export function normalizeEmail(raw: string): string {
  const e = (raw || '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  let local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const plus = local.indexOf('+')
  if (plus > 0) local = local.slice(0, plus)
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '')
    return `${local}@gmail.com`
  }
  return `${local}@${domain}`
}

export function isValidEmail(raw: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((raw || '').trim())
}

export function isExpired(e: { expiresAt?: string }): boolean {
  return !!e.expiresAt && new Date(e.expiresAt).getTime() < Date.now()
}

/** Aktionen an einem Freigabeeintrag. */
export type AllowAction = 'approve' | 'suspend' | 'reactivate' | 'disable' | 'revoke' | 'setRole' | 'delete'
