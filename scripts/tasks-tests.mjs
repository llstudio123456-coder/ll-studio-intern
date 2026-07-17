/**
 * Tests für Aufgaben (Plattform-Phase 1).
 *
 * Teil A spiegelt die Regeln aus @shared/tasks: Sichtbarkeit (Spez. §30 — persönliche Aufgaben
 * sind auch für Administratoren unlesbar), Überfälligkeit und die Wiederholungsrechnung.
 * Teil B prüft die HTTP-Oberfläche ohne Session.
 *
 * Aufruf: npm run test:tasks   (Basis über TEST_TASKS_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_TASKS_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }
const skipped = (n, w) => { skip++; console.log(`SKIP  ${n} — ${w}`) }

/* ── Spiegel der Produktionslogik ── */

const RANK = { viewer: 0, guest: 1, member: 2, employee: 3, admin: 4, owner: 5 }
const roleAtLeast = (r, min) => (r ? RANK[r] >= RANK[min] : false)
const CLOSED = ['erledigt', 'abgebrochen', 'archiviert']

function canReadTask(actor, t) {
  if (!actor) return false
  if (t.creatorId === actor.id || t.assigneeId === actor.id) return true
  return t.visibility === 'team'
}
function canEditTask(actor, t) {
  if (!actor) return false
  if (t.creatorId === actor.id || t.assigneeId === actor.id) return true
  if (t.visibility !== 'team') return false
  return roleAtLeast(actor.role, 'employee')
}
function canDeleteTask(actor, t) {
  if (!actor) return false
  return !!t.creatorId && t.creatorId === actor.id
}
function isOverdue(t) {
  if (!t.dueDate || CLOSED.includes(t.status)) return false
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return new Date(t.dueDate) < h
}
// Durchgehend UTC — die lokalen Setter verlieren über die Sommerzeitgrenze einen Tag.
function nextDueDate(from, r) {
  const d = new Date(from)
  if (Number.isNaN(d.getTime())) return from
  if (r === 'taeglich') d.setUTCDate(d.getUTCDate() + 1)
  else if (r === 'woechentlich') d.setUTCDate(d.getUTCDate() + 7)
  else if (r === 'zweiwoechentlich') d.setUTCDate(d.getUTCDate() + 14)
  else if (r === 'monatlich') d.setUTCMonth(d.getUTCMonth() + 1)
  else if (r === 'jaehrlich') d.setUTCFullYear(d.getUTCFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const owner = { id: 'o1', role: 'owner' }
const admin = { id: 'a1', role: 'admin' }
const ich = { id: 'e1', role: 'employee' }
const kollege = { id: 'e2', role: 'employee' }
const gast = { id: 'g1', role: 'guest' }

console.log('\n── A: Persönliche Aufgabe ist privat (Spez. §30) ──')
const privat = { creatorId: ich.id, visibility: 'private' }
ok('Ersteller liest seine private Aufgabe', canReadTask(ich, privat) === true)
ok('Administrator liest sie NICHT', canReadTask(admin, privat) === false)
ok('Inhaber liest sie NICHT', canReadTask(owner, privat) === false)
ok('Kollege liest sie NICHT', canReadTask(kollege, privat) === false)
ok('Administrator kann sie nicht bearbeiten', canEditTask(admin, privat) === false)
ok('Inhaber kann sie nicht löschen', canDeleteTask(owner, privat) === false)

console.log('\n── A: Private Aufgabe an eine Person zugewiesen ──')
const zugewiesen = { creatorId: ich.id, assigneeId: kollege.id, visibility: 'private' }
ok('Zuständiger liest sie', canReadTask(kollege, zugewiesen) === true)
ok('Zuständiger darf sie bearbeiten', canEditTask(kollege, zugewiesen) === true)
ok('Zuständiger darf sie NICHT löschen (nur der Ersteller)', canDeleteTask(kollege, zugewiesen) === false)
ok('Unbeteiligter Administrator liest sie NICHT', canReadTask(admin, zugewiesen) === false)

console.log('\n── A: Team-Aufgabe ──')
const team = { creatorId: ich.id, visibility: 'team' }
for (const u of [admin, owner, kollege]) ok(`${u.role} liest die Team-Aufgabe`, canReadTask(u, team) === true)
ok('Gast liest die Team-Aufgabe', canReadTask(gast, team) === true)
ok('Mitarbeiter darf Team-Aufgabe bearbeiten', canEditTask(kollege, team) === true)
ok('Gast darf Team-Aufgabe NICHT bearbeiten', canEditTask(gast, team) === false)
ok('Fremder darf Team-Aufgabe nicht löschen', canDeleteTask(kollege, team) === false)

console.log('\n── A: Überfällig ──')
ok('Gestern fällig, offen → überfällig', isOverdue({ dueDate: '2020-01-01', status: 'offen' }) === true)
ok('Gestern fällig, erledigt → NICHT überfällig', isOverdue({ dueDate: '2020-01-01', status: 'erledigt' }) === false)
ok('Gestern fällig, abgebrochen → NICHT überfällig', isOverdue({ dueDate: '2020-01-01', status: 'abgebrochen' }) === false)
ok('Zukunft → nicht überfällig', isOverdue({ dueDate: '2099-01-01', status: 'offen' }) === false)
ok('Ohne Termin → nie überfällig', isOverdue({ status: 'offen' }) === false)

console.log('\n── A: Wiederkehrende Aufgaben ──')
ok('Täglich: +1 Tag', nextDueDate('2026-03-10', 'taeglich') === '2026-03-11')
ok('Wöchentlich: +7 Tage', nextDueDate('2026-03-10', 'woechentlich') === '2026-03-17')
ok('Zweiwöchentlich: +14 Tage', nextDueDate('2026-03-10', 'zweiwoechentlich') === '2026-03-24')
ok('Monatlich: +1 Monat', nextDueDate('2026-03-10', 'monatlich') === '2026-04-10')
ok('Jährlich: +1 Jahr', nextDueDate('2026-03-10', 'jaehrlich') === '2027-03-10')
ok('Monatsende wird korrekt behandelt', nextDueDate('2026-01-31', 'monatlich').startsWith('2026-03'))
// Sommerzeit: Der Sprung ueber die Umstellung darf keinen Tag verschlucken. Mit lokalen
// Settern lieferte "monatlich" ab dem 10. Maerz faelschlich den 09. April.
ok('Sommerzeit-Beginn: monatlich bleibt auf dem Tag', nextDueDate('2026-03-10', 'monatlich') === '2026-04-10')
ok('Sommerzeit-Beginn: woechentlich bleibt auf dem Tag', nextDueDate('2026-03-25', 'woechentlich') === '2026-04-01')
ok('Sommerzeit-Beginn: taeglich bleibt auf dem Tag', nextDueDate('2026-03-28', 'taeglich') === '2026-03-29')
ok('Sommerzeit-Ende: taeglich bleibt auf dem Tag', nextDueDate('2026-10-24', 'taeglich') === '2026-10-25')
ok('Ungueltiges Datum bleibt unveraendert', nextDueDate('kein-datum', 'monatlich') === 'kein-datum')
// Der wichtigste Fall: gerechnet wird ab dem Termin, nicht ab heute — sonst wandert ein
// wöchentlicher Termin bei verspätetem Abhaken dauerhaft nach hinten.
ok('Rechnet ab Termin, nicht ab heute', nextDueDate('2020-01-01', 'woechentlich') === '2020-01-08')

/* ── Teil B: HTTP ── */

const j = async (p, init) => {
  const r = await fetch(BASE + p, { redirect: 'manual', ...init })
  return { status: r.status, text: await r.text().catch(() => '') }
}

console.log('\n── B: Ohne Session ──')
try {
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (!me.configured) {
    skipped('Aufgaben-API ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    const list = await j('/api/workspace/tasks')
    ok('Aufgabenliste ohne Session liefert nicht 200', list.status !== 200, `war ${list.status}`)
    const create = await j('/api/workspace/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'test' }) })
    ok('Aufgabe anlegen ohne Session liefert nicht 200', create.status !== 200, `war ${create.status}`)
  }
  const ghost = await j('/api/workspace/tasks/11111111-2222-3333-4444-555555555555')
  ok('Unbekannte Aufgabe liefert kein 200', ghost.status !== 200, `war ${ghost.status}`)
  ok('Antwort verrät keine Aufgabendaten', !/"title":|"assigneeId":/.test(ghost.text))
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Aufgaben: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
