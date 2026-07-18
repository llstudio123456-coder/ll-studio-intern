/* ─────────────────────────  Telefonnummern — Links & Normalisierung  ───────────────────────── */

/**
 * Erzeugt aus einer geschriebenen Telefonnummer den sauberen `tel:`-Wert im E.164-Format
 * (z. B. `+492211234567`). Gibt null zurück, wenn die Nummer offensichtlich ungültig ist —
 * dann wird bewusst KEIN fehlerhafter Anruf-Link erzeugt (Spezifikation §21).
 *
 * Deckt die deutschen Schreibweisen aus §17 ab:
 *   0221 1234567            → +492211234567
 *   0221 / 123 45 67        → +492211234567
 *   0049 221 1234567        → +492211234567
 *   +49 (0) 221 1234567     → +492211234567   (die 0 nach der Ländervorwahl entfällt)
 *
 * Andere Länder: Eine bereits mit `+`/`00` und Ländervorwahl geschriebene Nummer bleibt erhalten.
 */
export function telHref(raw?: string | null, defaultCc = '49'): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  const intl = s.startsWith('+') || s.startsWith('00')

  let digits = s.replace(/\D/g, '')
  if (s.startsWith('00')) digits = digits.replace(/^00/, '') // 0049… → 49…

  if (intl) {
    // „+49 (0) 221…" wird nach dem Ziffernstrip zu „490221…" — die 0 hinter der Vorwahl weg.
    if (digits.startsWith(defaultCc + '0')) digits = defaultCc + digits.slice(defaultCc.length + 1)
  } else if (digits.startsWith('0')) {
    // Nationale Schreibweise: führende 0 durch die Ländervorwahl ersetzen.
    digits = defaultCc + digits.slice(1)
  } else {
    // Weder „+"/„00" noch führende 0: zu mehrdeutig für einen zuverlässigen Link.
    return null
  }

  // Plausibilität: E.164 erlaubt 8–15 Ziffern. Zu kurz/lang → lieber kein Link.
  if (digits.length < 8 || digits.length > 15) return null
  return '+' + digits
}

/** Ist aus der Nummer ein gültiger Anruf-Link erzeugbar? */
export function isCallable(raw?: string | null): boolean {
  return telHref(raw) !== null
}

/**
 * Fax-Erkennung: Eine als Fax gekennzeichnete Nummer darf nicht als Anruf-Knopf hervorgehoben
 * werden (Spezifikation §20). Prüft ein optionales Typfeld ODER einen „Fax"-Hinweis im Text.
 */
export function isFax(kindOrText?: string | null): boolean {
  if (!kindOrText) return false
  return /fax/i.test(kindOrText)
}
