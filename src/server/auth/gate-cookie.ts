/**
 * Edge-sichere Signierung/Prüfung des Cookies der zweiten Sicherheitsfreigabe (Web Crypto HMAC-SHA256).
 * Enthält KEINE Geheimnisse im Klartext und keine sensiblen Daten – nur Bindung an Benutzer + Versionen + Ablauf.
 * Die AUTHORITATIVE Prüfung von pwVersion/gateEpoch erfolgt serverseitig gegen die DB (siehe guard.ts).
 */
export const GATE_COOKIE = 'll_gate'
/** Zusätzliche, kurzlebige Freigabe für /admin (eigenes Cookie, eigener Ablauf). */
export const ADMIN_COOKIE = 'll_admin'

export interface GatePayload {
  uid: string // Benutzer-ID (Bindung an die Google-Session)
  pv: number // Passwortversion zum Zeitpunkt der Freigabe
  ge: number // gate_epoch zum Zeitpunkt der Freigabe
  iat: number // ausgestellt (Sekunden)
  exp: number // Ablauf (Sekunden)
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const enc = (s: string): BufferSource => new TextEncoder().encode(s) as unknown as BufferSource

async function hmacKey(): Promise<CryptoKey | null> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  return crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Signiert eine Gate-Payload → `payloadB64.sigB64`. */
export async function signGate(payload: GatePayload): Promise<string> {
  const key = await hmacKey()
  if (!key) throw new Error('AUTH_SECRET fehlt')
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(body)))
  return `${body}.${b64url(sig)}`
}

/** Prüft Signatur + Ablauf; liefert die Payload oder null. Keine DB-Prüfung (edge-sicher). */
export async function verifyGate(value?: string | null): Promise<GatePayload | null> {
  return verifySigned<GatePayload>(value)
}

async function verifySigned<T extends { exp: number }>(value?: string | null): Promise<T | null> {
  if (!value || !value.includes('.')) return null
  const key = await hmacKey()
  if (!key) return null
  const [body, sig] = value.split('.')
  try {
    const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(sig) as unknown as BufferSource, enc(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as T
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/* ── Zusätzliche Admin-Freigabe (/admin) ── */

export interface AdminPayload {
  uid: string // an die Google-Session gebunden
  ge: number // gate_epoch: ein Widerruf der Gate-Freigabe entwertet auch die Admin-Freigabe
  tv: number // token_version: Sperren/Deaktivieren entwertet sofort
  iat: number
  exp: number // kurzlebig (siehe ADMIN_STEP_UP.maxAge)
}

export async function signAdmin(payload: AdminPayload): Promise<string> {
  const key = await hmacKey()
  if (!key) throw new Error('AUTH_SECRET fehlt')
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(body)))
  return `${body}.${b64url(sig)}`
}

/** Prüft Signatur + Ablauf. Die Bindung an uid/ge/tv prüft der Server gegen die DB (guard.ts). */
export async function verifyAdmin(value?: string | null): Promise<AdminPayload | null> {
  return verifySigned<AdminPayload>(value)
}
