import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2'
import { getPasswordRow } from './repo'
import { isProd } from './config'

// OWASP-orientierte Parameter (Memory 19 MiB, t=2, p=1). Argon2id ist der Bibliotheks-Default.
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, ARGON_OPTS)
}

/** Prüft ein eingegebenes Zugangspasswort gegen den aktiven Hash (zeitkonstant über argon2). */
export async function verifyGatePassword(plain: string): Promise<boolean> {
  const row = getPasswordRow()
  if (!row.isActive || !row.passwordHash) return false
  try {
    return await argonVerify(row.passwordHash, plain)
  } catch {
    return false
  }
}

export interface GateStatus {
  configured: boolean // Passwort eingerichtet?
  active: boolean
  isDevelopmentPassword: boolean
  passwordVersion: number
  gateEpoch: number
  /** In Produktion mit Testpasswort/unkonfiguriert → Zugriff hart verweigern. */
  refuseInProd: boolean
}

export function gateStatus(): GateStatus {
  const row = getPasswordRow()
  const configured = !!row.passwordHash && row.isActive
  const refuseInProd = isProd && (!configured || row.isDevelopmentPassword)
  return {
    configured,
    active: row.isActive,
    isDevelopmentPassword: row.isDevelopmentPassword,
    passwordVersion: row.passwordVersion,
    gateEpoch: row.gateEpoch,
    refuseInProd
  }
}

/** Offensichtlich unsichere Passwörter (für die spätere echte Passwortvergabe). */
const WEAK = new Set(['123', '1234', '12345', '123456', 'passwort', 'password', 'admin', 'llstudio', 'll-studio'])
export function isWeakPassword(plain: string): boolean {
  const p = plain.trim().toLowerCase()
  if (WEAK.has(p)) return true
  if (p.length < 14) return true
  return false
}
