import { cookies } from 'next/headers'
import { guardApi } from '@/server/auth/guard'
import { isProd, ADMIN_STEP_UP } from '@/server/auth/config'
import { getPasswordRow, audit } from '@/server/auth/repo'
import { verifyGatePassword } from '@/server/auth/gate'
import { ADMIN_COOKIE, signAdmin } from '@/server/auth/gate-cookie'
import { rateLimit, rateReset, clientKey } from '@/server/auth/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Erneute Bestätigung für den Adminbereich. Der normale Login reicht bewusst NICHT:
 * Wer /admin öffnet, muss den internen Sicherheitscode noch einmal eingeben. Die Freigabe
 * ist kurzlebig (ADMIN_STEP_UP.maxAge) und an uid + token_version + gate_epoch gebunden,
 * damit Sperren, Sitzungswiderruf oder ein Codewechsel sie sofort entwerten.
 */
export async function POST(req: Request) {
  // Voraussetzung: angemeldet, aktiv, Gate bestätigt, mindestens Admin. Noch OHNE Step-up —
  // den stellen wir hier ja gerade aus. Deshalb geht guardAdmin hier nicht (das verlangte
  // genau die Bestätigung, die diese Route erst ausstellt) und der Null-Schutz muss hierher.
  const g = await guardApi({ role: 'admin', gate: true })
  if (!g.ok) return g.response
  // Im lokal unkonfigurierten Zustand liefert guardApi bewusst user=null (die App läuft offen).
  // Ohne diese Prüfung stürzte die Route mit 500 ab, statt sauber zu verweigern.
  if (!g.user) {
    return Response.json({ success: false, ok: false, error: 'Sicherheitseinrichtung erforderlich.' }, { status: 503 })
  }
  const user = g.user

  // Strenger als das Gate: 3 Versuche / 15 min. Ein Angreifer mit gekaperter Sitzung
  // soll den Code nicht durchprobieren können.
  const key = `admin-stepup:${user.id}:${clientKey(req)}`
  const rl = rateLimit(key, 3, 15 * 60 * 1000)
  if (!rl.allowed) {
    audit('admin_stepup_ratelimited', { userId: user.id, email: user.email, success: false })
    return Response.json({ success: false, ok: false, error: 'Die Bestätigung war nicht erfolgreich.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })
  }

  let password = ''
  try {
    const body = (await req.json()) as { password?: string }
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    /* ignore */
  }
  if (!password || !(await verifyGatePassword(password))) {
    audit('admin_stepup_failed', { userId: user.id, email: user.email, success: false })
    return Response.json({ success: false, ok: false, error: 'Die Bestätigung war nicht erfolgreich.' }, { status: 403 })
  }

  rateReset(key)
  const nowSec = Math.floor(Date.now() / 1000)
  const value = await signAdmin({
    uid: user.id,
    ge: getPasswordRow().gateEpoch,
    tv: user.tokenVersion,
    iat: nowSec,
    exp: nowSec + ADMIN_STEP_UP.maxAge
  })
  ;(await cookies()).set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_STEP_UP.maxAge
  })
  audit('admin_stepup_success', { userId: user.id, email: user.email })
  // Ziel serverseitig bestimmen: Nur interne Admin-Pfade sind erlaubt, damit ein manipulierter
  // ?from= keine Weiterleitung auf eine fremde Seite erzeugen kann (Open Redirect).
  const from = new URL(req.url).searchParams.get('from')
  return Response.json({ success: true, ok: true, redirectTo: safeAdminTarget(from), expiresIn: ADMIN_STEP_UP.maxAge })
}

/** Admin-Freigabe zurücknehmen (Adminbereich verlassen). */
export async function DELETE() {
  ;(await cookies()).delete(ADMIN_COOKIE)
  return Response.json({ success: true, ok: true })
}

/**
 * Nur interne Adminpfade als Ziel zulassen. Ein „//evil.com" oder „https://evil.com" im
 * ?from= wäre sonst eine offene Weiterleitung.
 */
function safeAdminTarget(from: string | null): string {
  if (from && from.startsWith('/admin') && !from.startsWith('//') && from !== '/admin/bestaetigen') return from
  return '/admin'
}
