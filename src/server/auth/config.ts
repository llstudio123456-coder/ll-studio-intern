import type { Role } from '@shared/auth'

/** Läuft die App produktiv? (steuert HTTPS-/Cookie-/Testpasswort-Härtung) */
export const isProd = process.env.NODE_ENV === 'production'

/**
 * Ist die Anmeldung überhaupt konfiguriert? Ohne Google-Client + AUTH_SECRET kann der
 * OAuth-Flow nicht laufen. In diesem Zustand läuft die App LOKAL offen (mit Warnbanner),
 * in PRODUKTION wird der Zugriff hart verweigert (siehe requireConfiguredOrRefuse).
 */
export function authConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.AUTH_SECRET
}

function parseList(v?: string): string[] {
  return (v || '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function allowedEmails(): string[] {
  return parseList(process.env.ALLOWED_GOOGLE_EMAILS)
}
export function allowedDomain(): string {
  return (process.env.ALLOWED_GOOGLE_DOMAIN || '').trim().toLowerCase()
}
export function initialAdminEmails(): string[] {
  return parseList(process.env.INITIAL_ADMIN_EMAILS)
}
/**
 * Inhaber-Konten. Bewusst NUR über die Umgebung steuerbar: Die Oberfläche kann die Inhaber-Rolle
 * weder vergeben noch entziehen, damit sich niemand über einen kompromittierten Admin-Zugang
 * selbst zum Inhaber macht oder den Inhaber aussperrt.
 */
export function ownerEmails(): string[] {
  return parseList(process.env.OWNER_EMAILS)
}
export function isOwnerEmail(email?: string): boolean {
  if (!email) return false
  return ownerEmails().includes(email.trim().toLowerCase())
}

/**
 * Serverseitige, geschlossene Zugriffsprüfung (Default-Deny).
 * Ein Konto ist nur zugelassen, wenn die verifizierte E-Mail exakt auf der Allowlist steht
 * ODER (falls konfiguriert) zur erlaubten Workspace-Domain gehört. Domain ALLEIN genügt nur,
 * wenn ALLOWED_GOOGLE_DOMAIN gesetzt ist; eine reine @gmail.com-Prüfung findet nie statt.
 */
export function isEmailAllowed(email?: string, emailVerified?: boolean): boolean {
  if (!email || !emailVerified) return false
  const e = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false
  if (allowedEmails().includes(e)) return true
  const dom = allowedDomain()
  if (dom && e.endsWith('@' + dom)) return true
  return false
}

/** Erst-Rolle beim ersten Login: owner vor admin, sonst member. */
export function initialRoleFor(email: string): Role {
  const e = email.trim().toLowerCase()
  if (ownerEmails().includes(e)) return 'owner'
  return initialAdminEmails().includes(e) ? 'admin' : 'member'
}

/**
 * Rolle, die bei JEDEM Login autoritativ aus der Umgebung erzwungen wird (sonst null).
 * Nötig, damit ein Inhaber-Konto auch dann Inhaber ist, wenn es früher als member/admin
 * angelegt wurde — und damit eine in der DB manipulierte Inhaber-Rolle wieder verschwindet.
 */
export function enforcedRoleFor(email: string): Role | null {
  return isOwnerEmail(email) ? 'owner' : null
}

/** Session-Laufzeiten (Sekunden) – konfigurierbare Ausgangswerte. */
export const SESSION = {
  idleTimeout: 30 * 60, // 30 min Inaktivität
  maxAge: 8 * 60 * 60 // 8 h absolute Laufzeit
}

/** Zusätzliche Admin-Freigabe für /admin: nach dieser Zeit ohne Aktivität erneut bestätigen. */
export const ADMIN_STEP_UP = {
  maxAge: 30 * 60 // 30 min
}
