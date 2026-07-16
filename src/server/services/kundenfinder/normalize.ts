import { createHash } from 'crypto'

const RECHTSFORMEN = [
  'gmbh & co. kg', 'gmbh & co kg', 'gmbh',
  'ug (haftungsbeschränkt)', 'ug', 'ohg', 'gbr', 'kg', 'ag', 'e.k.', 'e. k.', 'ek', 'e.v.', 'e. v.', 'ev',
  'mbh', 'kgaa', 'partg', 'se', 'ltd', 'inc', 'llc'
]

/** Normalisiert eine Domain: Protokoll/www/Pfad entfernen, kleinschreiben (registrierbare Hauptdomain). */
export function normalizeDomain(input?: string): string {
  if (!input) return ''
  let s = input.trim().toLowerCase()
  if (!s) return ''
  if (!/^https?:\/\//.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    let host = u.hostname.replace(/^www\./, '')
    if (!host.includes('.')) return ''
    return host
  } catch {
    return ''
  }
}

/** Normalisiert eine deutsche Telefonnummer auf reine Ziffern (0049/+49 → 0). */
export function normalizePhone(input?: string): string {
  if (!input) return ''
  let s = input.replace(/[^\d+]/g, '')
  if (!s) return ''
  s = s.replace(/^\+49/, '0').replace(/^0049/, '0')
  s = s.replace(/\D/g, '')
  // führende Doppel-Null (internationale Reste) vereinfachen
  if (s.length >= 6) return s
  return ''
}

/** Normalisiert eine E-Mail (trim + lowercase). Generische Postfächer bleiben erhalten. */
export function normalizeEmail(input?: string): string {
  if (!input) return ''
  const s = input.trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : ''
}

/** Trennt die Rechtsform vom Firmennamen; liefert normalisierten Namen + erkannte Rechtsform. */
export function splitRechtsform(name: string): { core: string; rechtsform: string } {
  let s = ' ' + name.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  let found = ''
  for (const rf of RECHTSFORMEN) {
    const token = ' ' + rf.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
    if (s.includes(token)) {
      found = rf
      s = s.replace(token, ' ')
    }
  }
  return { core: s.replace(/\s+/g, ' ').trim(), rechtsform: found }
}

/** Normalisierter Firmenname (ohne Rechtsform, ohne Sonderzeichen, kleingeschrieben). */
export function normalizeName(name?: string): string {
  if (!name) return ''
  const { core } = splitRechtsform(name)
  return core
    .replace(/[^a-z0-9äöüß ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stabiler Unternehmens-Fingerprint aus Name + PLZ + Hausnummer + Domain. */
export function fingerprint(parts: { name?: string; plz?: string; houseNumber?: string; domain?: string }): string {
  const nameNorm = normalizeName(parts.name)
  const domain = normalizeDomain(parts.domain)
  const key = [nameNorm, (parts.plz || '').trim(), (parts.houseNumber || '').trim().toLowerCase(), domain].join('|')
  if (!nameNorm && !domain) return ''
  return createHash('sha1').update(key).digest('hex').slice(0, 20)
}

/** Levenshtein-Distanz. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1))
      prevDiag = tmp
    }
  }
  return prev[b.length]
}

/** Deutsche Mobilnummer? Erwartet 0-führende, normalisierte Nummer (015x/016x/017x). */
export function isGermanMobile(normalizedPhone?: string): boolean {
  if (!normalizedPhone) return false
  return /^01(5\d|6\d|7\d)/.test(normalizedPhone)
}

/** Generisches/unpersönliches Firmenpostfach (info@, kontakt@ …) – keiner Person zuzuordnen. */
export function isGenericEmail(email?: string): boolean {
  const e = normalizeEmail(email)
  if (!e) return false
  const local = e.split('@')[0].replace(/[._-]/g, '')
  const generic = [
    'info', 'kontakt', 'contact', 'office', 'mail', 'email', 'service', 'buchhaltung', 'empfang', 'praxis',
    'kanzlei', 'team', 'hallo', 'moin', 'post', 'zentrale', 'sekretariat', 'verwaltung', 'anfrage', 'anfragen',
    'newsletter', 'noreply', 'nomail', 'webmaster', 'shop', 'bestellung', 'termin', 'termine', 'rezeption', 'willkommen'
  ]
  return generic.includes(local)
}

const NAME_TITLES = [
  'prof. dr.', 'prof.dr.', 'dr. med. dent.', 'dr. med.', 'dr. rer. nat.', 'dr. jur.', 'dr.-ing.', 'dr.', 'prof.',
  'dipl.-ing.', 'dipl.-kfm.', 'dipl.-oec.', 'mag.', 'm.sc.', 'b.sc.', 'll.m.', 'rechtsanwalt', 'rechtsanwältin'
]

/**
 * Zerlegt einen Personennamen in Anrede, akad. Titel, Vor- und Nachname.
 * Konservativ: ohne Rateverfahren, nur was klar erkennbar ist.
 */
export function splitPersonName(raw: string): { fullName: string; salutation?: string; title?: string; firstName?: string; lastName?: string } {
  let s = (raw || '').replace(/\s+/g, ' ').trim()
  if (!s) return { fullName: '' }
  let salutation: string | undefined
  const salMatch = s.match(/^(Herr|Frau)\b\.?\s+/i)
  if (salMatch) { salutation = /frau/i.test(salMatch[1]) ? 'Frau' : 'Herr'; s = s.slice(salMatch[0].length).trim() }

  const titles: string[] = []
  let changed = true
  while (changed) {
    changed = false
    const low = s.toLowerCase()
    for (const t of NAME_TITLES) {
      if (low.startsWith(t + ' ')) {
        titles.push(s.slice(0, t.length))
        s = s.slice(t.length).trim()
        changed = true
        break
      }
    }
  }
  const title = titles.length ? titles.join(' ') : undefined
  const parts = s.split(' ').filter(Boolean)
  let firstName: string | undefined
  let lastName: string | undefined
  if (parts.length === 1) lastName = parts[0]
  else if (parts.length >= 2) { firstName = parts.slice(0, parts.length - 1).join(' '); lastName = parts[parts.length - 1] }
  const fullName = [title, firstName, lastName].filter(Boolean).join(' ').trim() || raw.trim()
  return { fullName, salutation, title, firstName, lastName }
}

/** Namens-Ähnlichkeit 0..1 (auf normalisierten Namen). */
export function nameSimilarity(a?: string, b?: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const d = levenshtein(na, nb)
  return 1 - d / Math.max(na.length, nb.length)
}
