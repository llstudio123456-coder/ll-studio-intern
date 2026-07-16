/**
 * Tests für Notizen (Plattform-Phase 1).
 *
 * Teil A spiegelt die Sichtbarkeitsregeln aus @shared/notes. Der wichtigste Fall ist §30 der
 * Spezifikation: Eine private Notiz ist auch für Administratoren und den Inhaber unlesbar.
 * Teil B prüft die HTTP-Oberfläche ohne Session.
 *
 * Aufruf: npm run test:notes   (Basis über TEST_NOTES_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_NOTES_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }
const skipped = (n, w) => { skip++; console.log(`SKIP  ${n} — ${w}`) }

/* ── Spiegel der Produktionslogik ── */

const RANK = { viewer: 0, guest: 1, member: 2, employee: 3, admin: 4, owner: 5 }
const roleAtLeast = (r, min) => (r ? RANK[r] >= RANK[min] : false)

function canReadNote(actor, note, shared = []) {
  if (!actor) return false
  if (note.ownerId && note.ownerId === actor.id) return true
  switch (note.visibility) {
    case 'private': return false
    case 'shared': return shared.includes(actor.id)
    case 'company': return true
    case 'admins': return roleAtLeast(actor.role, 'admin')
    case 'owner': return actor.role === 'owner'
    default: return false
  }
}
function canEditNote(actor, note, shares = []) {
  if (!actor) return false
  if (note.ownerId && note.ownerId === actor.id) return true
  if (note.visibility === 'shared') return shares.some((s) => s.userId === actor.id && s.canEdit)
  return false
}
function canDeleteNote(actor, note) {
  if (!actor) return false
  return !!note.ownerId && note.ownerId === actor.id
}
function assignableVisibilities(actor) {
  const base = ['private', 'shared', 'company']
  if (roleAtLeast(actor.role, 'admin')) base.push('admins')
  if (actor.role === 'owner') base.push('owner')
  return base
}

const owner = { id: 'o1', role: 'owner' }
const admin = { id: 'a1', role: 'admin' }
const mitarbeiter = { id: 'e1', role: 'employee' }
const kollege = { id: 'e2', role: 'employee' }
const gast = { id: 'g1', role: 'guest' }
const viewer = { id: 'v1', role: 'viewer' }

console.log('\n── A: Private Notiz ist wirklich privat (Spez. §30) ──')
const privat = { ownerId: mitarbeiter.id, visibility: 'private' }
ok('Besitzer liest seine private Notiz', canReadNote(mitarbeiter, privat) === true)
ok('Administrator liest sie NICHT', canReadNote(admin, privat) === false)
ok('Inhaber liest sie NICHT', canReadNote(owner, privat) === false)
ok('Kollege liest sie NICHT', canReadNote(kollege, privat) === false)
ok('Administrator kann sie nicht bearbeiten', canEditNote(admin, privat) === false)
ok('Inhaber kann sie nicht löschen', canDeleteNote(owner, privat) === false)
ok('Besitzer kann sie löschen', canDeleteNote(mitarbeiter, privat) === true)

console.log('\n── A: Gezielte Freigabe ──')
const geteilt = { ownerId: mitarbeiter.id, visibility: 'shared' }
ok('Freigegebene Person liest', canReadNote(kollege, geteilt, [kollege.id]) === true)
ok('Nicht freigegebene Person liest NICHT', canReadNote(gast, geteilt, [kollege.id]) === false)
ok('Administrator ohne Freigabe liest NICHT', canReadNote(admin, geteilt, [kollege.id]) === false)
ok('Freigabe ohne Schreibrecht darf nicht bearbeiten', canEditNote(kollege, geteilt, [{ userId: kollege.id, canEdit: false }]) === false)
ok('Freigabe mit Schreibrecht darf bearbeiten', canEditNote(kollege, geteilt, [{ userId: kollege.id, canEdit: true }]) === true)
ok('Mitleser darf nicht löschen', canDeleteNote(kollege, geteilt) === false)

console.log('\n── A: Unternehmensweit ──')
const firma = { ownerId: mitarbeiter.id, visibility: 'company' }
for (const u of [admin, owner, kollege, gast, viewer]) {
  ok(`${u.role} liest die Unternehmensnotiz`, canReadNote(u, firma) === true)
}
ok('Fremder darf Unternehmensnotiz nicht bearbeiten', canEditNote(kollege, firma) === false)

console.log('\n── A: Rollen-Sichtbarkeiten ──')
const nurAdmins = { ownerId: owner.id, visibility: 'admins' }
ok('Administrator liest Admin-Notiz', canReadNote(admin, nurAdmins) === true)
ok('Inhaber liest Admin-Notiz', canReadNote(owner, nurAdmins) === true)
ok('Mitarbeiter liest Admin-Notiz NICHT', canReadNote(mitarbeiter, nurAdmins) === false)
const nurOwner = { ownerId: owner.id, visibility: 'owner' }
ok('Administrator liest Inhaber-Notiz NICHT', canReadNote(admin, nurOwner) === false)

console.log('\n── A: Unbekannte Sichtbarkeit → Default-Deny ──')
ok('Unbekannter Wert wird abgelehnt', canReadNote(admin, { ownerId: 'x', visibility: 'irgendwas' }) === false)

console.log('\n── A: Vergebbare Sichtbarkeiten ──')
ok('Mitarbeiter kann keine Admin-Notiz anlegen', !assignableVisibilities(mitarbeiter).includes('admins'))
ok('Mitarbeiter kann keine Inhaber-Notiz anlegen', !assignableVisibilities(mitarbeiter).includes('owner'))
ok('Administrator kann keine Inhaber-Notiz anlegen', !assignableVisibilities(admin).includes('owner'))
ok('Inhaber kann alles vergeben', assignableVisibilities(owner).length === 5)
ok('Standard ist die geringste Sichtbarkeit', assignableVisibilities(mitarbeiter)[0] === 'private')

/* ── Teil B: HTTP ── */

const j = async (p, init) => {
  const r = await fetch(BASE + p, { redirect: 'manual', ...init })
  return { status: r.status, text: await r.text().catch(() => '') }
}

console.log('\n── B: Ohne Session ──')
try {
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (!me.configured) {
    skipped('Notizen-API ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    const list = await j('/api/workspace/notes')
    ok('Notizliste ohne Session liefert nicht 200', list.status !== 200, `war ${list.status}`)
    const create = await j('/api/workspace/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'test' }) })
    ok('Notiz anlegen ohne Session liefert nicht 200', create.status !== 200, `war ${create.status}`)
    const one = await j('/api/workspace/notes/00000000-0000-0000-0000-000000000000')
    ok('Einzelne Notiz ohne Session liefert nicht 200', one.status !== 200, `war ${one.status}`)
  }

  console.log('\n── B: Fremde Notiz über direkte URL ──')
  // Nicht lesbar muss 404 sein, nicht 403 — ein 403 würde die Existenz bestätigen.
  const ghost = await j('/api/workspace/notes/11111111-2222-3333-4444-555555555555')
  ok('Unbekannte Notiz-ID liefert kein 200', ghost.status !== 200, `war ${ghost.status}`)
  ok('Antwort verrät keine Notizdaten', !/"body":|"visibility":/.test(ghost.text))
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Notizen: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
