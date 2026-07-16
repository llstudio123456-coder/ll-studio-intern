import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { authConfigured, isProd } from '@/server/auth/config'
import { getUserById, getPasswordRow } from '@/server/auth/repo'
import { gateStatus } from '@/server/auth/gate'
import { GATE_COOKIE, verifyGate } from '@/server/auth/gate-cookie'
import { INACTIVE_STATUSES, roleAtLeast } from '@shared/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Minimaler, sicherer Status für die Client-Navigation (keine Secrets, keine internen Details). */
export async function GET() {
  if (!authConfigured()) {
    return Response.json({ ok: true, configured: false, prodRefuse: isProd, authenticated: false, user: null, gate: { required: false, verified: false } })
  }
  const session = await auth()
  const uid = session?.user?.id
  const user = uid ? getUserById(uid) : null
  const authenticated = !!user && !INACTIVE_STATUSES.includes(user.status)

  const gs = gateStatus()
  let gateVerified = false
  if (authenticated) {
    const cookie = (await cookies()).get(GATE_COOKIE)?.value
    const payload = await verifyGate(cookie)
    const pw = getPasswordRow()
    gateVerified = !!payload && payload.uid === user!.id && payload.pv === pw.passwordVersion && payload.ge === pw.gateEpoch
  }

  return Response.json({
    ok: true,
    configured: true,
    prodRefuse: gs.refuseInProd,
    authenticated,
    user: authenticated ? { email: user!.email, name: user!.name, picture: user!.picture, role: user!.role, status: user!.status } : null,
    gate: {
      required: true,
      verified: gateVerified,
      isDev: gs.isDevelopmentPassword,
      needsSetup: gs.needsSetup,
      // Einrichten darf nur ein Admin. Ohne dieses Flag zeigt die Seite einem Member sonst ein
      // Formular, das die Route anschließend mit 403 ablehnt.
      canSetup: authenticated && gs.needsSetup && roleAtLeast(user!.role, 'admin')
    }
  })
}
