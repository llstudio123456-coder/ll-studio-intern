/**
 * Serverseitiges In-Memory-Rate-Limit (Sliding Window). Für den lokalen Single-Node-Betrieb
 * ausreichend; für Mehr-Instanzen-Produktion später auf einen geteilten Speicher (z. B. Redis) umstellen.
 */
interface Entry { count: number; resetAt: number }
const buckets = new Map<string, Entry>()

export interface RateResult { allowed: boolean; remaining: number; retryAfterSec: number }

/** Prüft/erhöht das Limit für einen Schlüssel. windowMs = Fensterdauer, max = erlaubte Versuche. */
export function rateLimit(key: string, max: number, windowMs: number): RateResult {
  const nowMs = Date.now()
  const e = buckets.get(key)
  if (!e || e.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs })
    return { allowed: true, remaining: max - 1, retryAfterSec: 0 }
  }
  if (e.count >= max) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((e.resetAt - nowMs) / 1000) }
  }
  e.count++
  return { allowed: true, remaining: max - e.count, retryAfterSec: 0 }
}

/** Setzt den Zähler eines Schlüssels zurück (z. B. nach erfolgreicher Freigabe). */
export function rateReset(key: string): void {
  buckets.delete(key)
}

/** Grobe, datensparsame IP-Kennung aus Request-Headern (nur für Rate-Limit/Audit). */
export function clientKey(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') || ''
  const ip = xf.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
  return ip
}
