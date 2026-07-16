import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { authConfigured, isProd, SESSION } from '@/server/auth/config'
import { getUserById, getPasswordRow, setGatePassword, audit } from '@/server/auth/repo'
import { hashPassword, gateStatus, isWeakPassword } from '@/server/auth/gate'
import { GATE_COOKIE, signGate } from '@/server/auth/gate-cookie'
import { rateLimit, clientKey } from '@/server/auth/ratelimit'
import { INACTIVE_STATUSES, roleAtLeast } from '@shared/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Ersteinrichtung der zweiten Sicherheitsfreigabe.
 *
 * Nur möglich, solange noch kein produktives Passwort existiert (bzw. in Produktion nur ein
 * Entwicklungs-Testpasswort). Danach verweigert die Route dauerhaft — ein späteres Zurücksetzen
 * läuft bewusst nicht über diesen Weg, sonst wäre die Sperre über die eigene Session aushebelbar.
 */
export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ ok: false, error: 'Anmeldung nicht konfiguriert.' }, { status: 400 })

  const session = await auth()
  const uid = session?.user?.id
  if (!uid) return Response.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 })
  const user = getUserById(uid)
  if (!user || INACTIVE_STATUSES.includes(user.status)) return Response.json({ ok: false, error: 'Kein Zugriff.' }, { status: 401 })

  const gs = gateStatus()
  if (!gs.needsSetup) {
    audit('gate_setup_already_done', { userId: user.id, email: user.email, success: false })
    return Response.json({ ok: false, error: 'Die Sicherheitsfreigabe ist bereits eingerichtet.' }, { status: 409 })
  }
  if (!roleAtLeast(user.role, 'admin')) {
    audit('gate_setup_forbidden', { userId: user.id, email: user.email, success: false })
    return Response.json({ ok: false, error: 'Nur ein Administrator kann die Sicherheitsfreigabe einrichten.' }, { status: 403 })
  }

  const rl = rateLimit(`gate-setup:${user.id}:${clientKey(req)}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    audit('gate_setup_ratelimited', { userId: user.id, email: user.email, success: false })
    return Response.json({ ok: false, error: 'Zu viele Versuche. Bitte später erneut versuchen.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })
  }

  let password = ''
  try {
    const body = (await req.json()) as { password?: string }
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    /* ignore */
  }
  const problem = passwordProblem(password)
  if (problem) return Response.json({ ok: false, error: problem }, { status: 400 })

  setGatePassword(await hashPassword(password), { isDev: false, changedBy: user.id })

  // Direkt freischalten: Wer das Passwort gerade vergeben hat, muss es nicht sofort erneut eintippen.
  const pw = getPasswordRow()
  const nowSec = Math.floor(Date.now() / 1000)
  const value = await signGate({ uid: user.id, pv: pw.passwordVersion, ge: pw.gateEpoch, iat: nowSec, exp: nowSec + SESSION.maxAge })
  ;(await cookies()).set(GATE_COOKIE, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION.maxAge
  })

  audit('gate_setup_success', { userId: user.id, email: user.email })
  return Response.json({ ok: true })
}

/**
 * Bei der Vergabe darf die Meldung konkret sein (der Benutzer wählt das Passwort selbst).
 * Bei der späteren Eingabe bleibt sie neutral, um kein Informationsleck zu erzeugen.
 */
function passwordProblem(p: string): string | null {
  if (!p) return 'Bitte ein Zugangspasswort eingeben.'
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return 'Das Passwort muss Buchstaben und Zahlen enthalten.'
  if (isWeakPassword(p)) return 'Das Passwort ist zu schwach: mindestens 14 Zeichen und keine offensichtlichen Begriffe.'
  return null
}
