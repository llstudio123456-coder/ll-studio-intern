/**
 * Edge-sichere Signierung/Prüfung des Cookies der zweiten Sicherheitsfreigabe (Web Crypto HMAC-SHA256).
 * Enthält KEINE Geheimnisse im Klartext und keine sensiblen Daten – nur Bindung an Benutzer + Versionen + Ablauf.
 * Die AUTHORITATIVE Prüfung von pwVersion/gateEpoch erfolgt serverseitig gegen die DB (siehe guard.ts).
 */
export const GATE_COOKIE = 'll_gate'

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
  if (!value || !value.includes('.')) return null
  const key = await hmacKey()
  if (!key) return null
  const [body, sig] = value.split('.')
  try {
    const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(sig) as unknown as BufferSource, enc(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as GatePayload
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
