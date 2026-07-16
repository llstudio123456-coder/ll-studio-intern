/**
 * Richtet EINMALIG das lokale Entwicklungs-Zugangspasswort der zweiten Sicherheitsfreigabe ein.
 * Speichert ausschließlich einen Argon2id-Hash (kein Klartext). Standardwert: "123" (nur lokal!).
 *
 *   npm run setup:dev-access-password            → setzt "123" (Dev-Kennzeichnung)
 *   npm run setup:dev-access-password -- "meinPW" → setzt ein anderes Passwort (nicht als Dev markiert)
 *
 * In Produktion verweigert die App den Zugriff, solange das Entwicklungs-Testpasswort aktiv ist.
 */
import Database from 'better-sqlite3'
import { hash } from '@node-rs/argon2'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const arg = process.argv[2]
const password = arg && arg.trim() ? arg.trim() : '123'
const isDev = password === '123'

const base = process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
if (!existsSync(base)) mkdirSync(base, { recursive: true })
const db = new Database(join(base, 'kundenfinder.db'))

// Tabelle sicherstellen (falls die App noch nie gestartet wurde).
db.exec(`
CREATE TABLE IF NOT EXISTS security_access_password (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT, password_version INTEGER NOT NULL DEFAULT 1, gate_epoch INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 0, is_development_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT, activated_at TEXT, changed_by_user_id TEXT
);
INSERT OR IGNORE INTO security_access_password (id, password_version, gate_epoch, is_active, is_development_password) VALUES (1, 1, 1, 0, 0);
`)

const h = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
const now = new Date().toISOString()
db.prepare(
  `UPDATE security_access_password
   SET password_hash=?, password_version = password_version + 1, gate_epoch = gate_epoch + 1,
       is_active=1, is_development_password=?, created_at=COALESCE(created_at,?), activated_at=?, changed_by_user_id='setup-script'
   WHERE id=1`
).run(h, isDev ? 1 : 0, now, now)

console.log(`✓ Zugangspasswort gesetzt (Argon2id-Hash gespeichert${isDev ? ', als DEV-Testpasswort markiert' : ''}).`)
if (isDev) console.log('  ⚠ "123" ist NUR für die lokale Entwicklung. Produktion verweigert diesen Zustand.')
db.close()
