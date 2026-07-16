/**
 * Tests für den Workspace-Dateibereich.
 *
 * Teil A prüft die Upload-Validierung direkt gegen die kompilierte Logik-Regeln (nachgebaut, damit
 * der Test ohne TS-Build läuft): Positivliste, Magic Bytes, Größe, Namensbereinigung.
 * Teil B prüft die HTTP-Oberfläche: ohne Session darf nichts gehen.
 *
 * Aufruf: npm run test:workspace   (Basis über TEST_WS_BASE, Standard http://localhost:3000)
 */
const BASE = process.env.TEST_WS_BASE || 'http://localhost:3000'

let pass = 0, fail = 0, skip = 0
const ok = (name, cond, info = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${info ? ' — ' + info : ''}`) }
}
const skipped = (name, why) => { skip++; console.log(`SKIP  ${name} — ${why}`) }

/* ── Teil A: Validierungsregeln (Spiegel von storage.ts) ── */

const ALLOWED = ['pdf','txt','csv','md','json','jpg','jpeg','png','webp','svg','zip','html','css','js','docx','xlsx','pptx']
const extensionOf = (n) => { const m = /\.([A-Za-z0-9]+)$/.exec(n.trim()); return m ? m[1].toLowerCase() : '' }
const sanitizeName = (raw) => {
  let n = (raw || '').normalize('NFC').replace(/[\x00-\x1f\x7f]/g, '')
  n = n.replace(/[\\/]/g, '_').replace(/^\.+/, '').trim()
  return n || 'unbenannt'
}
function sniffMismatch(buf, ext) {
  const s = (...b) => b.every((x, i) => buf[i] === x)
  const text = () => (buf.subarray(0, 8000).includes(0) ? 'binär' : null)
  switch (ext) {
    case 'pdf': return s(0x25,0x50,0x44,0x46) ? null : 'kein PDF'
    case 'png': return s(0x89,0x50,0x4e,0x47) ? null : 'kein PNG'
    case 'jpg': case 'jpeg': return s(0xff,0xd8,0xff) ? null : 'kein JPEG'
    case 'zip': case 'docx': case 'xlsx': case 'pptx': return s(0x50,0x4b,0x03,0x04) || s(0x50,0x4b,0x05,0x06) ? null : 'kein ZIP'
    case 'svg': { const h = buf.subarray(0,1000).toString('utf8').trim().toLowerCase(); return h.includes('<svg') || h.startsWith('<?xml') ? null : 'kein SVG' }
    case 'txt': case 'csv': case 'md': case 'json': case 'html': case 'css': case 'js': return text()
    default: return 'nicht erlaubt'
  }
}

console.log('\n── A: Gefährliche Dateitypen ──')
for (const bad of ['virus.exe', 'skript.bat', 'shell.sh', 'setup.msi', 'run.cmd', 'x.ps1']) {
  ok(`${bad} wird abgelehnt`, !ALLOWED.includes(extensionOf(bad)))
}
ok('Datei ohne Endung wird abgelehnt', extensionOf('readme') === '')

console.log('\n── A: Falscher MIME-Type / getarnte Datei ──')
const exeAsPng = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])           // MZ = Windows-EXE
ok('EXE getarnt als .png fällt auf', sniffMismatch(exeAsPng, 'png') !== null)
const realPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
ok('Echtes PNG wird akzeptiert', sniffMismatch(realPng, 'png') === null)
ok('EXE getarnt als .pdf fällt auf', sniffMismatch(exeAsPng, 'pdf') !== null)
ok('Binärmüll als .txt fällt auf', sniffMismatch(Buffer.from([0x41, 0x00, 0x42]), 'txt') !== null)
ok('Echtes PDF wird akzeptiert', sniffMismatch(Buffer.from('%PDF-1.7'), 'pdf') === null)
ok('SVG mit <svg> wird akzeptiert', sniffMismatch(Buffer.from('<svg xmlns="..">'), 'svg') === null)

console.log('\n── A: Namensbereinigung (Path-Traversal) ──')
ok('../ wird entschärft', !sanitizeName('../../etc/passwd').includes('/'))
ok('Backslash wird entschärft', !sanitizeName('..\\..\\windows\\system32').includes('\\'))
ok('Führende Punkte fallen weg', !sanitizeName('.htaccess').startsWith('.'))
ok('Leerzeichen bleiben erhalten', sanitizeName('Angebot Müller GmbH.pdf') === 'Angebot Müller GmbH.pdf')
ok('Bindestriche bleiben erhalten', sanitizeName('Vertrag-2026-final.pdf') === 'Vertrag-2026-final.pdf')
const withCtrl = 'Bo' + String.fromCharCode(7) + 'se' + String.fromCharCode(0) + '.pdf'
ok('Steuerzeichen fallen weg', sanitizeName(withCtrl) === 'Bose.pdf')
ok('Leerer Name bekommt Ersatz', sanitizeName('') === 'unbenannt')

/* ── Teil B: HTTP ── */

const j = async (path, init) => {
  const r = await fetch(BASE + path, { redirect: 'manual', ...init })
  return { status: r.status, text: await r.text().catch(() => '') }
}

console.log('\n── B: Ohne Session ──')
try {
  const me = JSON.parse((await j('/api/auth/me')).text || '{}')
  if (!me.configured) {
    skipped('Workspace-API ohne Session', 'Anmeldung lokal nicht konfiguriert, App läuft offen (Absicht)')
  } else {
    for (const [name, path, init] of [
      ['Ordnerinhalt', '/api/workspace/files?folder=root', undefined],
      ['Papierkorb', '/api/workspace/trash', undefined],
      ['Upload', '/api/workspace/files', { method: 'POST' }],
      ['Ordner anlegen', '/api/workspace/folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"x"}' }]
    ]) {
      const r = await j(path, init)
      ok(`${name} ohne Session liefert nicht 200`, r.status !== 200, `war ${r.status}`)
    }
    const dl = await j('/api/workspace/files/00000000-0000-0000-0000-000000000000')
    ok('Download ohne Session liefert nicht 200', dl.status !== 200, `war ${dl.status}`)
  }
} catch (e) {
  fail++
  console.log(`FAIL  HTTP-Teil nicht ausführbar — ${e.message} (läuft der Server auf ${BASE}?)`)
}

console.log(`\n════ Workspace: ${pass}/${pass + fail} bestanden${skip ? `, ${skip} übersprungen` : ''} ════`)
process.exit(fail ? 1 : 0)
