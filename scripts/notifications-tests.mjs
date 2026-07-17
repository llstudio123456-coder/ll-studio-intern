/**
 * Tests für Benachrichtigungen (Plattform-Phase 1, letzter Baustein).
 *
 * Teil A spiegelt safeLink() aus @shared/notifications. Eine Benachrichtigung ist ein besonders
 * gefährlicher Ort für eine offene Weiterleitung: Sie kommt aus dem eigenen Werkzeug, man klickt
 * sie also besonders bereitwillig an.
 * Teil B prüft die HTTP-Oberfläche ohne Session.
 *
 * Aufruf: npm run test:notifications   (Basis über TEST_NOTIF_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_NOTIF_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }
const skipped = (n, w) => { skip++; console.log(`SKIP  ${n} — ${w}`) }

/* ── Spiegel der Produktionslogik ── */

function safeLink(link) {
  if (!link) return undefined
  if (!link.startsWith('/')) return undefined
  if (link.startsWith('//')) return undefined
  if (link.includes('\\')) return undefined
  return link
}

/** Spiegel von notify(): Der Auslöser bekommt nie eine eigene Benachrichtigung. */
function targetsOf(userIds, actorId) {
  return [...new Set(userIds)].filter((u) => u && u !== actorId)
}

console.log('\n── A: Keine offene Weiterleitung ──')
for (const evil of [
  'https://evil.com',
  'http://evil.com',
  '//evil.com',
  '/\\evil.com',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  '\\\\evil.com\\share',
  'ftp://evil.com'
]) {
  ok(`„${evil}" wird verworfen`, safeLink(evil) === undefined)
}

console.log('\n── A: Interne Ziele bleiben erhalten ──')
for (const good of ['/workspace/chat?kanal=abc', '/workspace/aufgaben?view=meine', '/workspace/notizen', '/admin']) {
  ok(`„${good}" bleibt erhalten`, safeLink(good) === good)
}
ok('Kein Link ist kein Fehler', safeLink(undefined) === undefined)
ok('Leerer Link wird verworfen', safeLink('') === undefined)

console.log('\n── A: Empfängerauswahl ──')
ok('Auslöser bekommt keine eigene Meldung', !targetsOf(['a', 'b'], 'a').includes('a'))
ok('Andere bekommen sie', targetsOf(['a', 'b'], 'a').includes('b'))
ok('Doppelte Empfänger werden entfernt', targetsOf(['b', 'b', 'c'], 'a').length === 2)
ok('Nur der Auslöser als Empfänger → niemand', targetsOf(['a'], 'a').length === 0)
ok('Leere Liste → niemand', targetsOf([], 'a').length === 0)
ok('Leere IDs werden verworfen', targetsOf(['', 'b'], 'a').length === 1)

/* ── Teil B: HTTP ── */

const j = async (p, init) => {
  const r = await fetch(BASE + p, { redirect: 'manual', ...init })
  return { status: r.status, text: await r.text().catch(() => '') }
}

console.log('\n── B: Ohne Session ──')
try {
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (!me.configured) {
    skipped('Benachrichtigungs-API ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    const list = await j('/api/workspace/notifications')
    ok('Liste ohne Session liefert nicht 200', list.status !== 200, `war ${list.status}`)
    ok('Antwort enthält keine Benachrichtigungen', !/"notifications":\s*\[\s*\{/.test(list.text))
    const mark = await j('/api/workspace/notifications', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'readAll' })
    })
    ok('Alle-gelesen ohne Session liefert nicht 200', mark.status !== 200, `war ${mark.status}`)
  }
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Benachrichtigungen: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
