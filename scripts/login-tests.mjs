/**
 * Regressionstests für den Login-Fehler (Priorität 1).
 *
 * Hintergrund: Nach korrekter Passworteingabe „passierte nichts", bis manuell neu geladen wurde.
 * Ursache war der Client Router Cache: Next.js prefetchte die geschützten Nav-Links, die Middleware
 * beantwortete diese Prefetches mit einer Weiterleitung zur Passwortseite, und der Cache merkte
 * sich das. Ein router.replace() traf danach nur den Cache — die Middleware sah das frisch
 * gesetzte Cookie nie.
 *
 * Diese Tests sichern die Eigenschaften ab, die den Fehler unmöglich machen:
 *   1. Auth-Weiterleitungen sind nicht zwischenspeicherbar (Cache-Control: no-store)
 *   2. Das ursprüngliche Ziel überlebt die Weiterleitung (?from=)
 *   3. Geschützte Nav-Links werden nicht geprefetcht
 *   4. Login-Antworten sind eindeutig (success/redirectTo) und lecken nichts
 *
 * Aufruf: npm run test:login   (Basis über TEST_LOGIN_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_LOGIN_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }
const skipped = (n, w) => { skip++; console.log(`SKIP  ${n} — ${w}`) }

const raw = async (p, init) => {
  const r = await fetch(BASE + p, { redirect: 'manual', ...init })
  return { status: r.status, headers: r.headers, text: await r.text().catch(() => '') }
}

try {
  const me = JSON.parse((await raw('/api/auth/me')).text || '{}')

  if (!me.configured) {
    skipped('Weiterleitungs-Tests', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    console.log('\n── 1: Auth-Weiterleitungen sind nicht cachebar ──')
    // Der Kern des Fehlers. Eine gecachte „nicht angemeldet"-Weiterleitung überlebt sonst den
    // Login und schickt den Benutzer zurück zur Passwortabfrage.
    for (const [name, path] of [['Dashboard', '/'], ['Kundenfinder', '/kundenfinder'], ['Adminbereich', '/admin']]) {
      const r = await raw(path)
      const isRedirect = r.status >= 300 && r.status < 400
      ok(`${name} ohne Session leitet weiter`, isRedirect, `status=${r.status}`)
      const cc = (r.headers.get('cache-control') || '').toLowerCase()
      ok(`${name}: Weiterleitung trägt no-store`, cc.includes('no-store'), `cache-control=${cc || '(fehlt)'}`)
    }

    console.log('\n── 2: Ursprüngliches Ziel überlebt die Weiterleitung ──')
    const deep = await raw('/kundenfinder?view=ergebnisse')
    const loc = deep.headers.get('location') || ''
    ok('Tiefer Link setzt ?from=', /[?&]from=/.test(loc), `location=${loc || '(keine)'}`)
    ok('from zeigt auf die angeforderte Seite', decodeURIComponent(loc).includes('/kundenfinder'), `location=${loc}`)
  }

  console.log('\n── 3: Geschützte Nav-Links werden nicht geprefetcht ──')
  // Next.js prefetcht <Link> standardmäßig. Genau diese Prefetches vergifteten den Cache.
  const login = await raw('/login')
  ok('Kein prefetch:true im ausgelieferten Nav-Markup', !/"prefetch":true/.test(login.text))

  console.log('\n── 4: Login-Antworten sind eindeutig ──')
  // Die Oberfläche muss Erfolg und Fehler unterscheiden können, ohne zu raten.
  const gate = await raw('/api/auth/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'falschesTestpasswort1' }) })
  const gateJson = JSON.parse(gate.text || '{}')
  ok('Gate-Antwort enthält success', typeof gateJson.success === 'boolean', gate.text.slice(0, 80))
  ok('Gate-Fehler liefert success:false', gateJson.success === false, gate.text.slice(0, 80))
  ok('Gate-Fehler liefert eine verständliche Meldung', typeof gateJson.error === 'string' && gateJson.error.length > 0)
  ok('Gate-Fehler enthält keinen Stack Trace', !/\bat \w+ \(|\.ts:\d+/.test(gate.text))

  const step = await raw('/api/admin/step-up', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'falschesTestpasswort1' }) })
  const stepJson = JSON.parse(step.text || '{}')
  ok('Admin-Antwort enthält success', typeof stepJson.success === 'boolean', step.text.slice(0, 80))
  ok('Admin-Fehler liefert success:false', stepJson.success === false, step.text.slice(0, 80))
  ok('Admin-Fehler enthält keinen Stack Trace', !/\bat \w+ \(|\.ts:\d+/.test(step.text))

  console.log('\n── 5: Kein Passwort in der Antwort ──')
  ok('Gate-Antwort enthält das eingegebene Passwort nicht', !gate.text.includes('falschesTestpasswort1'))
  ok('Admin-Antwort enthält das eingegebene Passwort nicht', !step.text.includes('falschesTestpasswort1'))
} catch (e) {
  fail++
  console.log(`FAIL  Nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Login: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
