/**
 * Tests für Projekte (Phase 2, erster Baustein).
 *
 * Teil A spiegelt die Regeln aus @shared/projects: Lesen/Bearbeiten/Verwalten, Fortschritt.
 * Teil B prüft die HTTP-Oberfläche ohne Session.
 *
 * Aufruf: npm run test:projects   (Basis über TEST_PROJ_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_PROJ_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }
const skipped = (n, w) => { skip++; console.log(`SKIP  ${n} — ${w}`) }

const RANK = { viewer: 0, guest: 1, member: 2, employee: 3, admin: 4, owner: 5 }
const roleAtLeast = (r, min) => (r ? RANK[r] >= RANK[min] : false)

function canReadProject(actor, p, isMember) {
  if (!actor) return false
  if (p.leadId === actor.id || isMember) return true
  return p.visibility === 'team'
}
function canEditProject(actor, p, isMember) {
  if (!actor) return false
  if (p.leadId === actor.id || isMember) return true
  if (p.visibility !== 'team') return false
  return roleAtLeast(actor.role, 'employee')
}
function canManageProject(actor, p) {
  if (!actor) return false
  if (p.leadId === actor.id || p.createdBy === actor.id) return true
  return roleAtLeast(actor.role, 'admin')
}
function projectProgress(count, done) {
  if (count <= 0) return 0
  return Math.round((done / count) * 100)
}

const owner = { id: 'o1', role: 'owner' }
const admin = { id: 'a1', role: 'admin' }
const lead = { id: 'l1', role: 'employee' }
const mitglied = { id: 'm1', role: 'employee' }
const fremd = { id: 'f1', role: 'employee' }
const gast = { id: 'g1', role: 'guest' }

console.log('\n── A: Privates Projekt ──')
const privat = { leadId: lead.id, createdBy: lead.id, visibility: 'private' }
ok('Leitung liest', canReadProject(lead, privat, false) === true)
ok('Mitglied liest', canReadProject(mitglied, privat, true) === true)
ok('Fremder liest NICHT', canReadProject(fremd, privat, false) === false)
ok('Administrator ohne Mitgliedschaft liest NICHT', canReadProject(admin, privat, false) === false)
ok('Inhaber ohne Mitgliedschaft liest NICHT', canReadProject(owner, privat, false) === false)
ok('Fremder darf NICHT bearbeiten', canEditProject(fremd, privat, false) === false)

console.log('\n── A: Team-Projekt ──')
const team = { leadId: lead.id, createdBy: lead.id, visibility: 'team' }
for (const u of [admin, owner, mitglied, fremd, gast]) ok(`${u.role} liest Team-Projekt`, canReadProject(u, team, false) === true)
ok('Mitarbeiter darf Team-Projekt bearbeiten', canEditProject(fremd, team, false) === true)
ok('Gast darf Team-Projekt NICHT bearbeiten', canEditProject(gast, team, false) === false)

console.log('\n── A: Verwalten (löschen, Mitglieder) ──')
ok('Leitung darf verwalten', canManageProject(lead, team) === true)
ok('Ersteller darf verwalten', canManageProject({ id: lead.id, role: 'employee' }, { leadId: 'x', createdBy: lead.id }) === true)
ok('Administrator darf verwalten', canManageProject(admin, team) === true)
ok('Inhaber darf verwalten', canManageProject(owner, team) === true)
ok('Normales Mitglied darf NICHT verwalten', canManageProject(mitglied, team) === false)
ok('Gast darf NICHT verwalten', canManageProject(gast, team) === false)

console.log('\n── A: Fortschritt ──')
ok('0 Aufgaben → 0 %', projectProgress(0, 0) === 0)
ok('Keine erledigt → 0 %', projectProgress(4, 0) === 0)
ok('Hälfte erledigt → 50 %', projectProgress(4, 2) === 50)
ok('Alle erledigt → 100 %', projectProgress(3, 3) === 100)
ok('Ein Drittel wird gerundet', projectProgress(3, 1) === 33)

/* ── Teil B: HTTP ── */

const j = async (p, init) => {
  const r = await fetch(BASE + p, { redirect: 'manual', ...init })
  return { status: r.status, text: await r.text().catch(() => '') }
}

console.log('\n── B: Ohne Session ──')
try {
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (!me.configured) {
    skipped('Projekt-API ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    const list = await j('/api/workspace/projects')
    ok('Projektliste ohne Session liefert nicht 200', list.status !== 200, `war ${list.status}`)
    const create = await j('/api/workspace/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Test' }) })
    ok('Projekt anlegen ohne Session liefert nicht 200', create.status !== 200, `war ${create.status}`)
  }
  const ghost = await j('/api/workspace/projects/11111111-2222-3333-4444-555555555555')
  ok('Unbekanntes Projekt liefert kein 200', ghost.status !== 200, `war ${ghost.status}`)
  ok('Antwort verrät keine Projektdaten', !/"members":|"chatChannelId":/.test(ghost.text))
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Projekte: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
