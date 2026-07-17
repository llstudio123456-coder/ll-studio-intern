/**
 * Tests für den Team-Chat (Plattform-Phase 1).
 *
 * Teil A spiegelt die Regeln aus @shared/chat: Wer liest, wer schreibt, wer moderiert.
 * Kernfälle der Spezifikation: nicht berechtigten Kanal über direkte URL öffnen (§22),
 * Nachricht in Nur-Lesen-Kanal senden (§35), Direktnachrichten sind für Admins tabu.
 * Teil B prüft die HTTP-Oberfläche ohne Session.
 *
 * Aufruf: npm run test:chat   (Basis über TEST_CHAT_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_CHAT_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }
const skipped = (n, w) => { skip++; console.log(`SKIP  ${n} — ${w}`) }

/* ── Spiegel der Produktionslogik ── */

const RANK = { viewer: 0, guest: 1, member: 2, employee: 3, admin: 4, owner: 5 }
const roleAtLeast = (r, min) => (r ? RANK[r] >= RANK[min] : false)

function canReadChannel(actor, ch, isMember) {
  if (!actor) return false
  if (isMember) return true
  if (ch.kind === 'dm') return false
  return ch.visibility === 'offen'
}
function canWriteChannel(actor, ch, isMember) {
  if (!actor) return false
  if (ch.archivedAt) return false
  if (!canReadChannel(actor, ch, isMember)) return false
  if (ch.writeRole) return roleAtLeast(actor.role, ch.writeRole)
  return roleAtLeast(actor.role, 'member')
}
function canEditMessage(actor, m) {
  if (!actor) return false
  return !!m.authorId && m.authorId === actor.id
}
function canPinMessage(actor, m) {
  if (!actor) return false
  return roleAtLeast(actor.role, 'admin') || m.authorId === actor.id
}
function parseMentions(body, users) {
  const hits = new Set()
  for (const u of users) {
    const handle = (u.name || u.email.split('@')[0]).trim()
    if (!handle) continue
    const re = new RegExp('(^|\\s)@' + handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (re.test(body)) hits.add(u.id)
  }
  return [...hits]
}

const owner = { id: 'o1', role: 'owner' }
const admin = { id: 'a1', role: 'admin' }
const ich = { id: 'e1', role: 'employee' }
const kollege = { id: 'e2', role: 'employee' }
const gast = { id: 'g1', role: 'guest' }
const viewer = { id: 'v1', role: 'viewer' }

const offen = { kind: 'kanal', visibility: 'offen' }
const privat = { kind: 'kanal', visibility: 'privat' }
const dm = { kind: 'dm', visibility: 'privat' }
const ankuendigungen = { kind: 'kanal', visibility: 'offen', writeRole: 'admin' }
const archiviert = { kind: 'kanal', visibility: 'offen', archivedAt: '2026-01-01' }

console.log('\n── A: Offener Kanal ──')
for (const u of [owner, admin, ich, gast, viewer]) ok(`${u.role} liest den offenen Kanal`, canReadChannel(u, offen, false) === true)
ok('Mitarbeiter darf schreiben', canWriteChannel(ich, offen, true) === true)
ok('Gast darf NICHT schreiben', canWriteChannel(gast, offen, true) === false)
ok('Viewer darf NICHT schreiben', canWriteChannel(viewer, offen, true) === false)

console.log('\n── A: Privater Kanal über direkte URL (Spez. §22) ──')
ok('Mitglied liest', canReadChannel(ich, privat, true) === true)
ok('Nicht-Mitglied liest NICHT', canReadChannel(kollege, privat, false) === false)
ok('Administrator ohne Mitgliedschaft liest NICHT', canReadChannel(admin, privat, false) === false)
ok('Inhaber ohne Mitgliedschaft liest NICHT', canReadChannel(owner, privat, false) === false)
ok('Nicht-Mitglied darf NICHT schreiben', canWriteChannel(kollege, privat, false) === false)

console.log('\n── A: Direktnachrichten sind geschlossen ──')
ok('Beteiligter liest', canReadChannel(ich, dm, true) === true)
ok('Administrator liest fremde DM NICHT', canReadChannel(admin, dm, false) === false)
ok('Inhaber liest fremde DM NICHT', canReadChannel(owner, dm, false) === false)
// Selbst wenn eine DM faelschlich als "offen" markiert waere, bleibt sie zu.
ok('DM bleibt zu, auch wenn faelschlich „offen“ markiert', canReadChannel(admin, { kind: 'dm', visibility: 'offen' }, false) === false)

console.log('\n── A: Ankündigungskanal ist Nur-Lesen (Spez. §10) ──')
ok('Mitarbeiter liest Ankündigungen', canReadChannel(ich, ankuendigungen, true) === true)
ok('Mitarbeiter darf dort NICHT schreiben', canWriteChannel(ich, ankuendigungen, true) === false)
ok('Gast darf dort NICHT schreiben', canWriteChannel(gast, ankuendigungen, true) === false)
ok('Administrator darf dort schreiben', canWriteChannel(admin, ankuendigungen, true) === true)
ok('Inhaber darf dort schreiben', canWriteChannel(owner, ankuendigungen, true) === true)

console.log('\n── A: Archivierter Kanal ──')
ok('Archivierter Kanal ist lesbar', canReadChannel(ich, archiviert, true) === true)
ok('Archivierter Kanal ist NICHT beschreibbar', canWriteChannel(ich, archiviert, true) === false)
ok('Auch der Administrator schreibt dort nicht', canWriteChannel(admin, archiviert, true) === false)

console.log('\n── A: Nachrichten bearbeiten und anheften ──')
const meine = { authorId: ich.id }
const fremde = { authorId: kollege.id }
ok('Eigene Nachricht bearbeitbar', canEditMessage(ich, meine) === true)
ok('Fremde Nachricht NICHT bearbeitbar', canEditMessage(ich, fremde) === false)
ok('Administrator bearbeitet fremde Nachricht NICHT', canEditMessage(admin, fremde) === false)
ok('Inhaber bearbeitet fremde Nachricht NICHT', canEditMessage(owner, fremde) === false)
ok('Administrator darf fremde Nachricht anheften', canPinMessage(admin, fremde) === true)
ok('Mitarbeiter darf fremde Nachricht NICHT anheften', canPinMessage(ich, fremde) === false)
ok('Eigene Nachricht darf man selbst anheften', canPinMessage(ich, meine) === true)

console.log('\n── A: Erwähnungen ──')
const users = [
  { id: 'u1', name: 'Max', email: 'max@ll.de' },
  { id: 'u2', name: 'Lisa', email: 'lisa@ll.de' },
  { id: 'u3', name: '', email: 'kaan@ll.de' }
]
ok('@Max wird erkannt', parseMentions('Hey @Max, schau mal', users).includes('u1'))
ok('Erwähnung am Zeilenanfang wird erkannt', parseMentions('@Lisa bitte pruefen', users).includes('u2'))
ok('Ohne Namen kein Treffer', parseMentions('Hallo zusammen', users).length === 0)
ok('Gross-/Kleinschreibung egal', parseMentions('hey @max', users).includes('u1'))
ok('Mehrere Erwähnungen', parseMentions('@Max und @Lisa', users).length === 2)
// Der wichtigste Fall: eine E-Mail-Adresse ist keine Erwaehnung.
ok('E-Mail-Adresse ist keine Erwähnung', parseMentions('schreib an mail@maxmuster.de', users).length === 0)
ok('Benutzer ohne Namen über E-Mail-Kürzel', parseMentions('@kaan bitte melden', users).includes('u3'))

/* ── Teil B: HTTP ── */

const j = async (p, init) => {
  const r = await fetch(BASE + p, { redirect: 'manual', ...init })
  return { status: r.status, text: await r.text().catch(() => '') }
}

console.log('\n── B: Ohne Session ──')
try {
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (!me.configured) {
    skipped('Chat-API ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    for (const [name, path, init] of [
      ['Kanalliste', '/api/workspace/chat/channels', undefined],
      ['Kanal öffnen', '/api/workspace/chat/channels/ch-allgemein', undefined],
      ['Echtzeit-Strom', '/api/workspace/chat/stream', undefined],
      ['Nachricht senden', '/api/workspace/chat/channels/ch-allgemein', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"body":"hallo"}' }]
    ]) {
      const r = await j(path, init)
      ok(`${name} ohne Session liefert nicht 200`, r.status !== 200, `war ${r.status}`)
    }
  }
  const ghost = await j('/api/workspace/chat/channels/11111111-2222-3333-4444-555555555555')
  ok('Unbekannter Kanal liefert kein 200', ghost.status !== 200, `war ${ghost.status}`)
  ok('Antwort verrät keine Kanaldaten', !/"messages":|"slug":/.test(ghost.text))
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Chat: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
