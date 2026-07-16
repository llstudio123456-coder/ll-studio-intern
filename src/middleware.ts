import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/auth.config'
import { authConfigured, isProd } from '@/server/auth/config'
import { GATE_COOKIE, ADMIN_COOKIE, verifyGate, verifyAdmin } from '@/server/auth/gate-cookie'
import { roleAtLeast, type Role } from '@shared/auth'

// Edge-Instanz nur aus der edge-sicheren Basis-Konfig (kein DB/Node-Code).
const { auth } = NextAuth(authConfig)

const PUBLIC_PREFIXES = ['/login', '/access-denied', '/gate', '/api/auth']
const isPrefix = (path: string, p: string) => path === p || path.startsWith(p + '/')
function isPublic(path: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => isPrefix(path, p))) return true
  if (path.startsWith('/_next') || path === '/favicon.ico' || path === '/robots.txt') return true
  return /\.(png|jpg|jpeg|gif|svg|ico|txt|webmanifest|woff2?)$/.test(path)
}

// `success` gehört auch hier hinein: Die Middleware blockt API-Anfragen, BEVOR sie die Route
// erreichen (z. B. /api/admin/step-up ohne Session). Ohne das Feld bekäme die Oberfläche für
// denselben Fehlerfall mal ein `success`, mal keines — je nachdem, wer geblockt hat.
const json = (status: number, error: string) =>
  NextResponse.json({ success: false, ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } })

/** Seiten, die nach erfolgreicher Eingabe zur ursprünglich angeforderten Seite zurückführen. */
const RETURNING_PAGES = ['/login', '/gate', '/admin/bestaetigen']

function toPage(reqUrl: string, to: string, from?: string) {
  const u = new URL(to, reqUrl)
  // Ohne /admin/bestaetigen in dieser Liste ging das Ziel verloren: Wer /admin/freigaben aufrief,
  // landete nach der Bestätigung immer auf /admin statt auf der gewünschten Seite.
  if (from && RETURNING_PAGES.includes(to)) u.searchParams.set('from', from)
  const res = NextResponse.redirect(u)
  // Auth-Weiterleitungen hängen vom Cookie-Zustand ab und dürfen NIE zwischengespeichert werden —
  // weder vom Browser noch vom Router. Sonst gilt „nicht angemeldet" nach dem Login weiter.
  res.headers.set('Cache-Control', 'no-store, must-revalidate')
  return res
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
  // roleAtLeast statt Gleichheit: Ein Inhaber ist ranghöher als ein Admin und muss überall
  // hineinkommen, wo ein Admin hineinkommt.
  const role = session.user.role as Role | undefined
  if (isPrefix(pathname, '/settings') && !roleAtLeast(role, 'admin')) {
    return toPage(req.url, '/access-denied?reason=role')
  }
  // Der Adminbereich zusätzlich: ohne frische Admin-Bestätigung geht hier nichts weiter.
  // Die Signatur wird hier edge-seitig geprüft, die Bindung an token_version/gate_epoch
  // autoritativ in guardAdmin gegen die Datenbank.
  if (isPrefix(pathname, '/admin') || isPrefix(pathname, '/api/admin')) {
    if (!roleAtLeast(role, 'admin')) {
      return isApi ? json(403, 'Keine Berechtigung.') : toPage(req.url, '/access-denied?reason=role')
    }
    // Die Bestätigungsroute selbst muss erreichbar bleiben — sonst kommt niemand je hinein.
    if (pathname !== '/api/admin/step-up' && pathname !== '/admin/bestaetigen') {
      const adm = await verifyAdmin(req.cookies.get(ADMIN_COOKIE)?.value)
      if (!adm || adm.uid !== session.user.id) {
        return isApi ? json(403, 'Admin-Bestätigung erforderlich.') : toPage(req.url, '/admin/bestaetigen', pathname)
      }
    }
  }

  return NextResponse.next()
})

// Auf allen Routen außer statischen Next-Assets ausführen.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
