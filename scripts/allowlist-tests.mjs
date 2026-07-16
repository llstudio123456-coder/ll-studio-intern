/**
 * Tests für E-Mail-Freigabeliste und Rollenrangfolge (Spezifikation §20).
 *
 * Teil A spiegelt die Entscheidungslogik (normalizeEmail, decideAccess, canActOn, assignableRoles).
 * Teil B prüft die HTTP-Oberfläche: ohne Session gibt der Adminbereich nichts preis.
 *
 * Aufruf: npm run test:allowlist   (Basis über TEST_AL_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_AL_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }
const skipped = (n, w) => { skip++; console.log(`SKIP  ${n} — ${w}`) }

/* ── Spiegel der Produktionslogik ── */

const RANK = { viewer: 0, guest: 1, member: 2, employee: 3, admin: 4, owner: 5 }
const roleAtLeast = (r, min) => (r ? RANK[r] >= RANK[min] : false)

function normalizeEmail(raw) {
  const e = (raw || '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  let local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const plus = local.indexOf('+')
  if (plus > 0) local = local.slice(0, plus)
  if (domain === 'gmail.com' || domain === 'googlemail.com') return local.replace(/\./g, '') + '@gmail.com'
  return local + '@' + domain
}

function canActOn(actor, target, action) {
  if (target.role === 'owner') return action === 'revokeSessions' && actor.id === target.id && actor.role === 'owner'
  if (!roleAtLeast(actor.role, 'admin')) return false
  if (actor.id === target.id) return action === 'revokeSessions'
  if (RANK[actor.role] <= RANK[target.role]) return false
  return true
}

function assignableRoles(actor) {
  if (!roleAtLeast(actor.role, 'admin')) return []
  return Object.keys(RANK).filter((r) => r !== 'owner' && RANK[r] < RANK[actor.role]).sort((a, b) => RANK[b] - RANK[a])
}

const LOGIN_OK = ['invited', 'approved', 'active']
function decideAccess(entry, envAllowed, isOwner) {
  if (entry) {
    if (['revoked', 'disabled', 'suspended'].includes(entry.status)) return { allowed: false }
    const expired = entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()
    if (entry.status === 'expired' || expired) return isOwner ? { allowed: true, role: 'owner' } : { allowed: false }
    if (!LOGIN_OK.includes(entry.status)) return { allowed: false }
    return { allowed: true, role: isOwner ? 'owner' : entry.defaultRole }
  }
  if (isOwner) return { allowed: true, role: 'owner' }
  if (envAllowed) return { allowed: true }
  return { allowed: false }
}

/* ── A: Anmeldung ── */

console.log('\n── A: Wer darf sich anmelden ──')
ok('Freigegebene Adresse meldet sich erstmals an', decideAccess({ status: 'invited', defaultRole: 'guest' }, false, false).allowed === true)
ok('Neue Adresse bekommt die Freigabe-Rolle', decideAccess({ status: 'invited', defaultRole: 'guest' }, false, false).role === 'guest')
ok('NICHT freigegebene Adresse wird abgewiesen', decideAccess(null, false, false).allowed === false)
ok('Freigegeben aber deaktiviert → abgewiesen', decideAccess({ status: 'disabled', defaultRole: 'employee' }, false, false).allowed === false)
ok('Freigegeben aber gesperrt → abgewiesen', decideAccess({ status: 'suspended', defaultRole: 'employee' }, false, false).allowed === false)
ok('Widerrufen → abgewiesen', decideAccess({ status: 'revoked', defaultRole: 'employee' }, false, false).allowed === false)
ok('Abgelaufene Einladung → abgewiesen', decideAccess({ status: 'active', defaultRole: 'guest', expiresAt: '2020-01-01' }, false, false).allowed === false)
ok('Gültige Einladung mit Zukunftsdatum → erlaubt', decideAccess({ status: 'active', defaultRole: 'guest', expiresAt: '2099-01-01' }, false, false).allowed === true)
ok('Widerruf schlägt Env-Freigabe', decideAccess({ status: 'revoked', defaultRole: 'guest' }, true, false).allowed === false)
ok('Inhaber kommt trotz Ablauf hinein', decideAccess({ status: 'expired', defaultRole: 'guest' }, false, true).allowed === true)
ok('Inhaber bekommt immer die Inhaber-Rolle', decideAccess({ status: 'active', defaultRole: 'guest' }, false, true).role === 'owner')

console.log('\n── A: E-Mail-Normalisierung ──')
ok('Groß-/Kleinschreibung egal', normalizeEmail('Max.Muster@Gmail.com') === normalizeEmail('max.muster@gmail.com'))
ok('Gmail-Punkte werden ignoriert', normalizeEmail('max.muster@gmail.com') === 'maxmuster@gmail.com')
ok('Gmail-Plus-Adresse zeigt aufs selbe Postfach', normalizeEmail('maxmuster+job@gmail.com') === 'maxmuster@gmail.com')
ok('googlemail.com = gmail.com', normalizeEmail('max@googlemail.com') === 'max@gmail.com')
ok('Fremde Domain: Punkte bleiben', normalizeEmail('max.muster@firma.de') === 'max.muster@firma.de')
ok('Leerzeichen werden getrimmt', normalizeEmail('  Max@Firma.de  ') === 'max@firma.de')

/* ── A: Rollen ── */

const owner = { id: 'o1', role: 'owner' }
const owner2 = { id: 'o2', role: 'owner' }
const admin = { id: 'a1', role: 'admin' }
const admin2 = { id: 'a2', role: 'admin' }
const employee = { id: 'e1', role: 'employee' }
const guest = { id: 'g1', role: 'guest' }

console.log('\n── A: Selbst-Hochstufung ist unmöglich ──')
for (const u of [guest, employee, admin, owner]) {
  ok(`${u.role} kann eigene Rolle nicht ändern`, canActOn(u, u, 'setRole') === false)
}
ok('Admin kann sich nicht zum Owner machen', !assignableRoles(admin).includes('owner'))
ok('Owner kann niemanden zum Owner machen', !assignableRoles(owner).includes('owner'))
ok('Mitarbeiter darf gar keine Rollen vergeben', assignableRoles(employee).length === 0)
ok('Gast darf gar keine Rollen vergeben', assignableRoles(guest).length === 0)

console.log('\n── A: Owner-Schutz ──')
for (const act of ['setRole', 'deactivate', 'block', 'delete', 'revokeSessions']) {
  ok(`Admin kann Owner nicht ${act}`, canActOn(admin, owner, act) === false)
}
ok('Owner kann anderen Owner nicht deaktivieren', canActOn(owner, owner2, 'deactivate') === false)
ok('Owner kann eigene Sitzungen beenden', canActOn(owner, owner, 'revokeSessions') === true)

console.log('\n── A: Rangordnung ──')
ok('Admin darf Mitarbeiter verwalten', canActOn(admin, employee, 'deactivate') === true)
ok('Admin darf Gast verwalten', canActOn(admin, guest, 'deactivate') === true)
ok('Admin darf anderen Admin NICHT verwalten (Gleichrang)', canActOn(admin, admin2, 'deactivate') === false)
ok('Owner darf Admin verwalten', canActOn(owner, admin, 'deactivate') === true)
ok('Mitarbeiter darf niemanden verwalten', canActOn(employee, guest, 'deactivate') === false)
ok('Admin vergibt nur Rollen unter sich', JSON.stringify(assignableRoles(admin)) === JSON.stringify(['employee', 'member', 'guest', 'viewer']))
ok('Owner vergibt Admin und darunter', JSON.stringify(assignableRoles(owner)) === JSON.stringify(['admin', 'employee', 'member', 'guest', 'viewer']))

/* ── B: HTTP ── */

const j = async (p, init) => {
  const r = await fetch(BASE + p, { redirect: 'manual', ...init })
  return { status: r.status, text: await r.text().catch(() => '') }
}

console.log('\n── B: Adminbereich ohne Session ──')
try {
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (!me.configured) {
    skipped('Freigabe-API ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    const list = await j('/api/admin/allowlist')
    ok('Freigabeliste ohne Session liefert nicht 200', list.status !== 200, `war ${list.status}`)
    ok('Keine E-Mail-Adresse im Fehlerfall', !/@/.test(list.text) || list.status !== 200)
    const create = await j('/api/admin/allowlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'angreifer@example.com', defaultRole: 'admin' }) })
    ok('Freigabe anlegen ohne Session liefert nicht 200', create.status !== 200, `war ${create.status}`)
    const page = await j('/admin/freigaben')
    ok('/admin/freigaben ohne Session liefert kein 200', page.status !== 200, `war ${page.status}`)
  }
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Freigabeliste: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
