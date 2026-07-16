import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/auth.config'
import { authConfigured, isProd } from '@/server/auth/config'
import { GATE_COOKIE, verifyGate } from '@/server/auth/gate-cookie'

// Edge-Instanz nur aus der edge-sicheren Basis-Konfig (kein DB/Node-Code).
const { auth } = NextAuth(authConfig)

const PUBLIC_PREFIXES = ['/login', '/access-denied', '/gate', '/api/auth']
function isPublic(path: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) return true
  if (path.startsWith('/_next') || path === '/favicon.ico' || path === '/robots.txt') return true
  return /\.(png|jpg|jpeg|gif|svg|ico|txt|webmanifest|woff2?)$/.test(path)
}

const json = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })
function toPage(reqUrl: string, to: string, from?: string) {
  const u = new URL(to, reqUrl)
  if (from && (to === '/login' || to === '/gate')) u.searchParams.set('from', from)
  return NextResponse.redirect(u)
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith('/api')
  if (isPublic(pathname)) return NextResponse.next()

  // Nicht konfiguriert: lokal offen (Entwicklung), Produktion hart verweigern.
  if (!authConfigured()) {
    if (isProd) return isApi ? json(503, 'Sicherheitseinrichtung erforderlich.') : toPage(req.url, '/access-denied?reason=setup')
    return NextResponse.next()
  }

  const session = req.auth
  if (!session?.user?.id) return isApi ? json(401, 'Nicht angemeldet.') : toPage(req.url, '/login', pathname)

  // Zweite Sicherheitsfreigabe (edge: Signatur + Ablauf + Benutzerbindung; pv/ge autoritativ in guard.ts).
  const payload = await verifyGate(req.cookies.get(GATE_COOKIE)?.value)
  if (!payload || payload.uid !== session.user.id) return isApi ? json(403, 'Sicherheitsfreigabe erforderlich.') : toPage(req.url, '/gate', pathname)

  // Grobe Rollenprüfung für besonders sensible Seiten (zusätzlich autoritativ serverseitig).
  if ((pathname === '/settings' || pathname.startsWith('/settings/')) && session.user.role !== 'admin') {
    return toPage(req.url, '/access-denied?reason=role')
  }

  return NextResponse.next()
})

// Auf allen Routen außer statischen Next-Assets ausführen.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
