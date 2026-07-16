import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { authConfigured, isProd } from '@/server/auth/config'
import { getUserById, getPasswordRow, audit } from '@/server/auth/repo'
import { verifyGatePassword, gateStatus } from '@/server/auth/gate'
import { GATE_COOKIE, signGate } from '@/server/auth/gate-cookie'
import { rateLimit, rateReset, clientKey } from '@/server/auth/ratelimit'
import { SESSION } from '@/server/auth/config'
import { INACTIVE_STATUSES } from '@shared/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Zweite Sicherheitsfreigabe: prüft das interne Zugangspasswort und setzt das signierte Gate-Cookie. */
export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ success: false, ok: false, error: 'Anmeldung nicht konfiguriert.' }, { status: 400 })
  const session = await auth()
  const uid = session?.user?.id
  if (!uid) return Response.json({ success: false, ok: false, error: 'Nicht angemeldet.' }, { status: 401 })
  const user = getUserById(uid)
  if (!user || INACTIVE_STATUSES.includes(user.status)) return Response.json({ success: false, ok: false, error: 'Kein Zugriff.' }, { status: 401 })

  const gs = gateStatus()
  if (gs.refuseInProd) {
    audit('gate_refused_prod', { userId: user.id, email: user.email, success: false })
    return Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
  }

  // Rate-Limit je Benutzer + IP: max. 5 Versuche / 15 min.
  const key = `gate:${user.id}:${clientKey(req)}`
  const rl = rateLimit(key, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    audit('gate_ratelimited', { userId: user.id, email: user.email, success: false })
    return Response.json({ success: false, ok: false, error: 'Die Sicherheitsfreigabe war nicht erfolgreich.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })
  }

  let password = ''
  try {
    const body = (await req.json()) as { password?: string }
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    /* ignore */
  }
  const ok = password ? await verifyGatePassword(password) : false
  if (!ok) {
    audit('gate_failed', { userId: user.id, email: user.email, success: false })
    // Bewusst neutrale Meldung (kein Informationsleck).
    return Response.json({ success: false, ok: false, error: 'Die Sicherheitsfreigabe war nicht erfolgreich.' }, { status: 403 })
  }

  rateReset(key)
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
  audit('gate_success', { userId: user.id, email: user.email })
  return Response.json({ ok: true })
}

/** Freigabe zurücknehmen (Logout aus der zweiten Sperre). */
export async function DELETE() {
  ;(await cookies()).delete(GATE_COOKIE)
  return Response.json({ ok: true })
}
