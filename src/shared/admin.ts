/* ─────────────────────────  Adminbereich — Typen  ───────────────────────── */

import type { Role, UserStatus, UserAction } from './auth'

/** Wie sich ein Benutzer anmeldet. Erweiterbar, falls später E-Mail+Passwort dazukommt. */
export type LoginMethod = 'google' | 'none'

/**
 * Passwortzustand für die Anzeige im Adminbereich.
 * Es gibt bewusst keinen Wert, der ein Passwort oder einen Hash transportiert.
 */
export type PasswordState = 'google' | 'set' | 'unset' | 'resetRequired'

export const PASSWORD_STATE_LABELS: Record<PasswordState, string> = {
  google: 'Login über Google',
  set: 'Passwort eingerichtet',
  unset: 'Passwort nicht eingerichtet',
  resetRequired: 'Passwort-Reset erforderlich'
}

export interface AdminUserRow {
  id: string
  email: string
  name?: string
  picture?: string
  role: Role
  status: UserStatus
  emailVerified: boolean
  loginMethod: LoginMethod
  passwordState: PasswordState
  createdAt: string
  lastLoginAt?: string
  lastActivityAt?: string
  approvedBy?: string
  /** Inhaber: gegen jede Änderung geschützt. */
  isProtectedOwner: boolean
  isSelf: boolean
  /** Vom Server berechnet — die Oberfläche bietet nur an, was der Server auch erlaubt. */
  allowedActions: UserAction[]
}
