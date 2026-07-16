import { createHash, randomUUID } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { readFile, writeFile, unlink } from 'fs/promises'
import { join } from 'path'

/**
 * Dateiablage auf dem Volume.
 *
 * Grundregel: Der Pfad auf der Platte leitet sich AUSSCHLIESSLICH aus einer serverseitig erzeugten
 * UUID ab. Vom Benutzer kommende Namen landen nur als Datenfeld in der DB und berühren niemals das
 * Dateisystem. Damit ist Path-Traversal („../../etc/passwd") strukturell unmöglich, statt per
 * Filterliste bekämpft zu werden.
 */

/** Obergrenze pro Datei. Bewusst konservativ — das Volume hat 500 MB gesamt. */
export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

export interface AllowedType {
  mime: string
  /** Wird beim Ausliefern erzwungen — nie der vom Client behauptete Typ. */
  serve: string
  /** true = niemals inline ausliefern (XSS-Gefahr), immer als Download. */
  forceDownload?: boolean
}

/**
 * Erlaubte Typen (Positivliste). Alles, was hier fehlt, wird abgelehnt — Ausführbares wie .exe,
 * .bat, .cmd, .sh, .ps1, .msi steht deshalb gar nicht erst zur Debatte.
 */
export const ALLOWED_TYPES: Record<string, AllowedType> = {
  pdf: { mime: 'application/pdf', serve: 'application/pdf' },
  txt: { mime: 'text/plain', serve: 'text/plain; charset=utf-8' },
  csv: { mime: 'text/csv', serve: 'text/csv; charset=utf-8', forceDownload: true },
  md: { mime: 'text/markdown', serve: 'text/plain; charset=utf-8' },
  json: { mime: 'application/json', serve: 'text/plain; charset=utf-8' },
  jpg: { mime: 'image/jpeg', serve: 'image/jpeg' },
  jpeg: { mime: 'image/jpeg', serve: 'image/jpeg' },
  png: { mime: 'image/png', serve: 'image/png' },
  webp: { mime: 'image/webp', serve: 'image/webp' },
  // SVG kann <script> enthalten. Inline ausgeliefert wäre es XSS auf eigener Domain →
  // immer als Download, in der Vorschau nur als Quelltext.
  svg: { mime: 'image/svg+xml', serve: 'text/plain; charset=utf-8', forceDownload: true },
  zip: { mime: 'application/zip', serve: 'application/zip', forceDownload: true },
  // Aus demselben Grund wie SVG: niemals als text/html oder application/javascript ausliefern.
  html: { mime: 'text/html', serve: 'text/plain; charset=utf-8', forceDownload: true },
  css: { mime: 'text/css', serve: 'text/plain; charset=utf-8', forceDownload: true },
  js: { mime: 'text/javascript', serve: 'text/plain; charset=utf-8', forceDownload: true },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', serve: 'application/octet-stream', forceDownload: true },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', serve: 'application/octet-stream', forceDownload: true },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', serve: 'application/octet-stream', forceDownload: true }
}

export function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}

/**
 * Bereinigt einen Dateinamen für Anzeige und Download-Header.
 * Entfernt Pfadtrenner, Steuerzeichen und führende Punkte; der Name steuert ohnehin keinen Pfad,
 * aber ein „../" im Content-Disposition-Header oder in der Oberfläche wäre trotzdem unschön.
 */
export function sanitizeName(raw: string): string {
  // Steuerzeichen raus (als Unicode-Escapes notiert, damit keine echten Steuerbytes in der Quelle landen).
  let n = (raw || '').normalize('NFC').replace(/[\x00-\x1f\x7f]/g, '')
  n = n.replace(/[\\/]/g, '_').replace(/^\.+/, '').trim()
  if (n.length > 200) {
    const ext = extensionOf(n)
    n = n.slice(0, 200 - (ext ? ext.length + 1 : 0)) + (ext ? '.' + ext : '')
  }
  return n || 'unbenannt'
}

export function normalizeName(raw: string): string {
  return sanitizeName(raw).toLowerCase()
}

/* ── Inhaltsprüfung ── */

/**
 * Prüft den tatsächlichen Inhalt gegen die Endung (Magic Bytes).
 * Die Behauptung des Clients („Content-Type") wird bewusst ignoriert — eine .exe, die sich als
 * .png ausgibt, fällt hier auf.
 *
 * @returns null wenn plausibel, sonst eine Begründung
 */
export function sniffMismatch(buf: Buffer, ext: string): string | null {
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b)
  const asText = () => {
    // Textformate: keine Magic Bytes, aber Null-Bytes verraten Binärmüll.
    const probe = buf.subarray(0, 8000)
    return probe.includes(0) ? 'Die Datei enthält Binärdaten, obwohl eine Textdatei erwartet wird.' : null
  }

  switch (ext) {
    case 'pdf':
      return startsWith(0x25, 0x50, 0x44, 0x46) ? null : 'Der Inhalt ist kein PDF.'
    case 'png':
      return startsWith(0x89, 0x50, 0x4e, 0x47) ? null : 'Der Inhalt ist kein PNG.'
    case 'jpg':
    case 'jpeg':
      return startsWith(0xff, 0xd8, 0xff) ? null : 'Der Inhalt ist kein JPEG.'
    case 'webp':
      return startsWith(0x52, 0x49, 0x46, 0x46) && buf.subarray(8, 12).toString() === 'WEBP' ? null : 'Der Inhalt ist kein WebP.'
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
      // Office-Formate sind ZIP-Container.
      return startsWith(0x50, 0x4b, 0x03, 0x04) || startsWith(0x50, 0x4b, 0x05, 0x06) ? null : 'Der Inhalt ist kein gültiges ZIP/Office-Dokument.'
    case 'svg': {
      const head = buf.subarray(0, 1000).toString('utf8').trim().toLowerCase()
      return head.includes('<svg') || head.startsWith('<?xml') ? null : 'Der Inhalt ist kein SVG.'
    }
    case 'txt':
    case 'csv':
    case 'md':
    case 'json':
    case 'html':
    case 'css':
    case 'js':
      return asText()
    default:
      return 'Dieser Dateityp ist nicht erlaubt.'
  }
}

export interface ValidationResult {
  ok: boolean
  error?: string
  ext?: string
  mime?: string
}

/** Vollständige serverseitige Prüfung einer hochgeladenen Datei. */
export function validateUpload(name: string, buf: Buffer): ValidationResult {
  const clean = sanitizeName(name)
  const ext = extensionOf(clean)
  if (!ext) return { ok: false, error: 'Die Datei hat keine Endung.' }
  const type = ALLOWED_TYPES[ext]
  if (!type) return { ok: false, error: `Dateien vom Typ „.${ext}" sind nicht erlaubt.` }
  if (buf.length === 0) return { ok: false, error: 'Die Datei ist leer.' }
  if (buf.length > MAX_FILE_SIZE) {
    return { ok: false, error: `Die Datei ist zu groß (max. ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB).` }
  }
  const mismatch = sniffMismatch(buf, ext)
  if (mismatch) return { ok: false, error: mismatch }
  return { ok: true, ext, mime: type.mime }
}

/* ── Ablage ── */

function filesRoot(): string {
  const base = process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
  const root = join(base, 'files')
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Pfad zu einem Speicherschlüssel. Akzeptiert ausschließlich UUIDs — damit kann selbst ein
 * manipulierter DB-Eintrag den Pfad nicht aus dem Verzeichnis herausführen.
 */
function pathFor(key: string): string {
  if (!KEY_RE.test(key)) throw new Error('Ungültiger Speicherschlüssel.')
  const dir = join(filesRoot(), key.slice(0, 2))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, key)
}

export function newStorageKey(): string {
  return randomUUID()
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export async function putObject(key: string, buf: Buffer): Promise<void> {
  await writeFile(pathFor(key), buf)
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(pathFor(key))
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await unlink(pathFor(key))
  } catch {
    // Bereits weg: kein Fehler. Endgültiges Löschen soll nicht daran scheitern.
  }
}
