import { cookies } from 'next/headers'
import type { AppUser, Role } from '@shared/auth'
import { INACTIVE_STATUSES, roleAtLeast } from '@shared/auth'
import { auth } from '@/auth'
import { authConfigured, isProd } from './config'
import { getUserById, touchActivity, getPasswordRow } from './repo'
import { gateStatus } from './gate'
import { GATE_COOKIE, ADMIN_COOKIE, verifyGate, verifyAdmin } from './gate-cookie'

export type GuardResult = { ok: true; user: AppUser | null } | { ok: false; response: Response }

const deny = (status: number, error: string) => Response.json({ ok: false, error }, { status })

/**
 * Autoritative serverseitige Zugriffsprüfung für API-Routen (Node).
 * Prüft: Konfiguration → gültige Google-Session → aktiver, nicht widerrufener Benutzer →
 * zweite Sicherheitsfreigabe (Gate) → erforderliche Rolle. Gibt bei Ablehnung eine sichere
 * Antwort ohne Informationsleck zurück.
 *
 * @param opts.role         Mindestrolle (z. B. 'admin' für Einstellungen/Benutzerverwaltung)
 * @param opts.gate         Zweite Passwortfreigabe erforderlich (Standard: true)
 * @param opts.adminStepUp  Zusätzliche, kurzlebige Admin-Bestätigung erforderlich (/admin)
 */
export async function guardApi(opts: { role?: Role; gate?: boolean; adminStepUp?: boolean } = {}): Promise<GuardResult> {
  const gateRequired = opts.gate !== false

  // 1) Nicht konfiguriert: lokal offen (Entwicklung), in Produktion hart verweigern.
  if (!authConfigured()) {
    if (isProd) return { ok: false, response: deny(503, 'Sicherheitseinrichtung erforderlich.') }
    return { ok: true, user: null }
  }

  // 2) Gültige Google-Session?
  const session = await auth()
  const uid = session?.user?.id
  if (!uid) return { ok: false, response: deny(401, 'Nicht angemeldet.') }

  // 3) Aktiver, nicht widerrufener Benutzer (autoritativ aus der DB).
  const user = getUserById(uid)
  if (!user || INACTIVE_STATUSES.includes(user.status)) return { ok: false, response: deny(401, 'Kein Zugriff.') }
  if (typeof session!.user!.tv === 'number' && session!.user!.tv !== user.tokenVersion) {
    return { ok: false, response: deny(401, 'Sitzung ungültig.') }
  }

  // 4) Zweite Sicherheitsfreigabe.
  if (gateRequired) {
    const gs = gateStatus()
    if (gs.refuseInProd) return { ok: false, response: deny(503, 'Sicherheitseinrichtung erforderlich.') }
    const cookie = (await cookies()).get(GATE_COOKIE)?.value
    const payload = await verifyGate(cookie)
    const pw = getPasswordRow()
    const gateOk = !!payload && payload.uid === user.id && payload.pv === pw.passwordVersion && payload.ge === pw.gateEpoch
    if (!gateOk) return { ok: false, response: deny(403, 'Sicherheitsfreigabe erforderlich.') }
  }

  // 5) Rolle.
  if (opts.role && !roleAtLeast(user.role, opts.role)) return { ok: false, response: deny(403, 'Keine Berechtigung.') }

  // 6) Zusätzliche, kurzlebige Admin-Freigabe (nur /admin und sensible Aktionen).
  if (opts.adminStepUp) {
    const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
    const payload = await verifyAdmin(cookie)
    const ok = !!payload && payload.uid === user.id && payload.tv === user.tokenVersion && payload.ge === getPasswordRow().gateEpoch
    if (!ok) return { ok: false, response: deny(403, 'Admin-Bestätigung erforderlich.') }
  }

  touchActivity(user.id)
  return { ok: true, user }
}

/**
 * Wie guardApi, aber für den Adminbereich: verlangt zusätzlich Admin-Rang und die frische
 * Admin-Bestätigung. `role` lässt sich auf 'owner' anheben, wenn eine Aktion nur dem Inhaber
 * offensteht.
 */
export async function guardAdmin(opts: { role?: Role } = {}): Promise<GuardResult> {
  const g = await guardApi({ role: opts.role || 'admin', gate: true, adminStepUp: true })
  if (!g.ok) return g
  // Im lokalen, unkonfigurierten Zustand liefert guardApi bewusst user=null (die App läuft offen).
  // Der Adminbereich darf so NIE laufen: Ohne echten Handelnden gäbe es niemanden, gegen den
  // canActOn prüfen könnte — der Owner-Schutz liefe ins Leere.
  if (!g.user) return { ok: false, response: deny(503, 'Sicherheitseinrichtung erforderlich.') }
  return g
}
