/**
 * Sicherheitstests für die Anmeldung/Autorisierung.
 * Erwartet eine KONFIGURIERTE Instanz (GOOGLE_CLIENT_ID/AUTH_SECRET gesetzt) unter TEST_AUTH_BASE.
 * Getestet wird die serverseitige Schutzgrenze OHNE gültige Session:
 * geschützte Seiten/APIs werden verweigert, öffentliche Auth-Seiten funktionieren,
 * Security-Header sind gesetzt, Secrets lecken nicht.
 *
 *   Server (konfiguriert) starten, dann:  npm run test:auth
 */
const BASE = process.env.TEST_AUTH_BASE || 'http://localhost:3100'
const LEAK = [process.env.AUTH_SECRET, process.env.GOOGLE_CLIENT_SECRET].filter(Boolean)
const results = []
const check = (n, ok, d = '') => { results.push({ n, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`) }

try {
  // 1) Geschützte API ohne Session → 401
  const api = await fetch(`${BASE}/api/kundenfinder/companies?limit=1`, { redirect: 'manual' })
  check('1: geschützte API ohne Session → 401', api.status === 401, `status=${api.status}`)
  const body = await api.text()
  check('1b: geschützte API gibt KEINE Daten zurück', !/companies|"ok":true/.test(body), body.slice(0, 60))

  // 2) Geschützte Seite ohne Session → Redirect auf /login
  const page = await fetch(`${BASE}/`, { redirect: 'manual' })
  const loc = page.headers.get('location') || ''
  check('2: Dashboard ohne Session → Redirect /login', page.status >= 300 && page.status < 400 && /\/login/.test(loc), `status=${page.status} loc=${loc}`)

  // 3) Login-Seite ist öffentlich + zeigt Google-Button
  const login = await fetch(`${BASE}/login`)
  const loginHtml = await login.text()
  check('3: /login öffentlich (200) + „Mit Google anmelden“', login.status === 200 && /Mit Google anmelden/.test(loginHtml))

  // 4) /api/auth/me: konfiguriert, aber nicht authentifiziert
  const me = await (await fetch(`${BASE}/api/auth/me`)).json()
  check('4: /api/auth/me → configured:true, authenticated:false', me.configured === true && me.authenticated === false, JSON.stringify(me).slice(0, 80))

  // 5) Security-Header gesetzt
  const h = login.headers
  check('5: X-Frame-Options: DENY', (h.get('x-frame-options') || '').toUpperCase() === 'DENY')
  check('5b: Content-Security-Policy vorhanden + frame-ancestors none', /frame-ancestors 'none'/.test(h.get('content-security-policy') || ''))
  check('5c: X-Robots-Tag noindex', /noindex/.test(h.get('x-robots-tag') || ''))
  check('5d: X-Content-Type-Options nosniff', (h.get('x-content-type-options') || '') === 'nosniff')

  // 6) Gate ohne Session → 401
  const gate = await fetch(`${BASE}/api/auth/gate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: '123' }), redirect: 'manual' })
  check('6: /api/auth/gate ohne Session → 401', gate.status === 401, `status=${gate.status}`)

  // 7) Secrets lecken nicht (Login-HTML + me-JSON)
  const meText = JSON.stringify(me)
  const leaked = LEAK.some((s) => s && (loginHtml.includes(s) || meText.includes(s)))
  check('7: AUTH_SECRET/CLIENT_SECRET NICHT im Login-HTML/me-JSON', !leaked && LEAK.length > 0, `geprüfte Secrets: ${LEAK.length}`)

  // 8) Neutrale Sperrseite
  const denied = await fetch(`${BASE}/access-denied?error=AccessDenied`)
  const deniedHtml = await denied.text()
  check('8: /access-denied (200) + neutrale Meldung', denied.status === 200 && /nicht freigegeben/i.test(deniedHtml))

  // 9) NextAuth-CSRF-Endpunkt (öffentlich) erreichbar
  const csrf = await fetch(`${BASE}/api/auth/csrf`)
  check('9: /api/auth/csrf öffentlich erreichbar (200)', csrf.status === 200, `status=${csrf.status}`)
} catch (e) {
  check('Testlauf ohne Abbruch', false, String(e))
}

const pass = results.filter((r) => r.ok).length
console.log(`\n════ Auth-Sicherheit: ${pass}/${results.length} bestanden ════`)
process.exit(pass === results.length ? 0 : 1)
