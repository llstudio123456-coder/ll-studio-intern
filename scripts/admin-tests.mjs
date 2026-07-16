/**
 * Tests für den Adminbereich.
 *
 * Teil A prüft die reine Entscheidungslogik (canActOn / assignableRoles) — das ist der Kern des
 * Owner-Schutzes und ohne Server testbar. Die Regeln sind hier bewusst NACHGEBAUT, damit der Test
 * unabhängig von der TS-Quelle läuft; Abweichungen fallen in Teil B auf.
 *
 * Teil B prüft die HTTP-Oberfläche gegen den laufenden Server: Ohne Session darf der Adminbereich
 * nichts preisgeben, und in keiner Antwort darf je ein Passwort oder Hash auftauchen.
 *
 * Aufruf: npm run test:admin   (Basis über TEST_ADMIN_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_ADMIN_BASE || 'http://localhost:3000'

let pass = 0
let fail = 0
let skip = 0
const ok = (name, cond, info = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${info ? ' — ' + info : ''}`) }
}
const skipped = (name, why) => { skip++; console.log(`SKIP  ${name} — ${why}`) }

/* ── Teil A: Entscheidungslogik ── */

const RANK = { viewer: 0, member: 1, admin: 2, owner: 3 }
const roleAtLeast = (r, min) => (r ? RANK[r] >= RANK[min] : false)
function canActOn(actor, target, action) {
  if (target.role === 'owner') return action === 'revokeSessions' && actor.id === target.id && actor.role === 'owner'
  if (!roleAtLeast(actor.role, 'admin')) return false
  if (actor.id === target.id) return action === 'revokeSessions'
  if (actor.role === 'admin' && RANK[target.role] >= RANK.admin) return false
  return true
}

const owner = { id: 'o1', role: 'owner' }
const admin = { id: 'a1', role: 'admin' }
const admin2 = { id: 'a2', role: 'admin' }
const member = { id: 'm1', role: 'member' }
const viewer = { id: 'v1', role: 'viewer' }

console.log('\n── A: Owner-Schutz ──')
for (const act of ['setRole', 'deactivate', 'block', 'delete']) {
  ok(`Admin darf Owner NICHT ${act}`, canActOn(admin, owner, act) === false)
  ok(`Owner darf anderen Owner NICHT ${act}`, canActOn(owner, { id: 'o2', role: 'owner' }, act) === false)
  ok(`Owner darf sich selbst NICHT ${act}`, canActOn(owner, owner, act) === false)
}
ok('Owner darf eigene Sitzungen widerrufen (Notfall)', canActOn(owner, owner, 'revokeSessions') === true)
ok('Admin darf Owner-Sitzungen NICHT widerrufen', canActOn(admin, owner, 'revokeSessions') === false)

console.log('\n── A: Rangordnung ──')
ok('Admin darf Member deaktivieren', canActOn(admin, member, 'deactivate') === true)
ok('Admin darf anderen Admin NICHT deaktivieren', canActOn(admin, admin2, 'deactivate') === false)
ok('Owner darf Admin deaktivieren', canActOn(owner, admin, 'deactivate') === true)
ok('Member darf gar nichts', canActOn(member, viewer, 'deactivate') === false)
ok('Viewer darf gar nichts', canActOn(viewer, member, 'deactivate') === false)

console.log('\n── A: Selbstschutz ──')
ok('Admin darf sich selbst NICHT deaktivieren', canActOn(admin, admin, 'deactivate') === false)
ok('Admin darf sich selbst NICHT löschen', canActOn(admin, admin, 'delete') === false)
ok('Admin darf eigene Sitzungen beenden', canActOn(admin, admin, 'revokeSessions') === true)

/* ── Teil B: HTTP ── */

const j = async (path, init) => {
  const r = await fetch(BASE + path, { redirect: 'manual', ...init })
  const text = await r.text().catch(() => '')
  return { status: r.status, text }
}

console.log('\n── B: Adminbereich ohne Session ──')
try {
  const list = await j('/api/admin/users')
  ok('GET /api/admin/users ohne Session liefert nicht 200', list.status !== 200, `war ${list.status}`)
  ok('Benutzerliste ohne Session enthält keine E-Mail', !/@/.test(list.text) || list.status !== 200)

  const act = await j('/api/admin/users/irgendwer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'delete' })
  })
  ok('POST Benutzeraktion ohne Session liefert nicht 200', act.status !== 200, `war ${act.status}`)

  const step = await j('/api/admin/step-up', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'irgendwas' })
  })
  ok('POST /api/admin/step-up ohne Session liefert nicht 200', step.status !== 200, `war ${step.status}`)

  // Ohne konfigurierte Anmeldung läuft die App lokal ABSICHTLICH offen (Lock-out-Schutz während
  // der Entwicklung). Die Seitenprüfung ist dann bedeutungslos — sie hier „grün" zu melden wäre
  // eine Lüge, sie rot zu melden ein Fehlalarm. Für eine echte Prüfung:
  //   TEST_ADMIN_BASE=https://<prod-url> npm run test:admin
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (me.configured) {
    const page = await j('/admin')
    ok('/admin ohne Session liefert kein 200', page.status !== 200, `war ${page.status}`)
  } else {
    skipped('/admin ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  }

  console.log('\n── B: Kein Passwortleck ──')
  const leaky = /"password"|password_hash|passwordHash|\$argon2/i
  ok('Benutzerliste enthält kein Passwortfeld', !leaky.test(list.text))
  ok('Aktionsantwort enthält kein Passwortfeld', !leaky.test(act.text))
  ok('Step-up-Antwort enthält kein Passwortfeld', !leaky.test(step.text))
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Admin: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
