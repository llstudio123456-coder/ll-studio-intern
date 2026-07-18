/**
 * Tests für die Telefon-Normalisierung (Kundenfinder §17/§26).
 * Spiegelt telHref() aus @shared/phone.
 *
 * Aufruf: npm run test:phone
 */
let pass = 0, fail = 0
const ok = (n, c, i = '') => { if (c) { pass++; console.log(`PASS  ${n}`) } else { fail++; console.log(`FAIL  ${n}${i ? ' — ' + i : ''}`) } }

function telHref(raw, defaultCc = '49') {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  const intl = s.startsWith('+') || s.startsWith('00')
  let digits = s.replace(/\D/g, '')
  if (s.startsWith('00')) digits = digits.replace(/^00/, '')
  if (intl) {
    if (digits.startsWith(defaultCc + '0')) digits = defaultCc + digits.slice(defaultCc.length + 1)
  } else if (digits.startsWith('0')) {
    digits = defaultCc + digits.slice(1)
  } else {
    return null
  }
  if (digits.length < 8 || digits.length > 15) return null
  return '+' + digits
}

console.log('\n── Deutsche Schreibweisen (§17) ──')
ok('0221 1234567',            telHref('0221 1234567') === '+492211234567', telHref('0221 1234567'))
ok('0221 / 123 45 67',        telHref('0221 / 123 45 67') === '+492211234567', telHref('0221 / 123 45 67'))
ok('0049 221 1234567',        telHref('0049 221 1234567') === '+492211234567', telHref('0049 221 1234567'))
ok('+49 (0) 221 1234567',     telHref('+49 (0) 221 1234567') === '+492211234567', telHref('+49 (0) 221 1234567'))
ok('+49 221 1234567',         telHref('+49 221 1234567') === '+492211234567', telHref('+49 221 1234567'))

console.log('\n── Weitere Formate (§26) ──')
ok('Mobilnummer 0170 1234567', telHref('0170 1234567') === '+491701234567', telHref('0170 1234567'))
ok('Mit Klammern (0221) 123456', telHref('(0221) 123456') === '+49221123456', telHref('(0221) 123456'))
ok('Mit Bindestrichen 0221-123-4567', telHref('0221-123-4567') === '+492211234567', telHref('0221-123-4567'))
ok('Internationale AT-Nummer +43 1 2345678', telHref('+43 1 2345678') === '+4312345678', telHref('+43 1 2345678'))

console.log('\n── Ungültige Nummern → kein Link (§21) ──')
ok('Leer → null', telHref('') === null)
ok('null → null', telHref(null) === null)
ok('Zu kurz „123" → null', telHref('123') === null)
ok('Nur Buchstaben → null', telHref('kein Telefon') === null)
ok('Mehrdeutig ohne 0/+ „1234567" → null', telHref('1234567') === null)
ok('Viel zu lang → null', telHref('0221 1234567 1234567 1234') === null)

console.log(`\n════ Telefon: ${pass}/${pass + fail} bestanden ════`)
process.exit(fail ? 1 : 0)
