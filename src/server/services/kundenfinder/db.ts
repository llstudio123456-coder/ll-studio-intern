import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

/** Speicherort der SQLite-DB (persistent auf Node-Host, gitignored über /.data/). */
function dbPath(): string {
  const base = process.env.LLI_DATA_DIR || join(process.cwd(), '.data')
  if (!existsSync(base)) mkdirSync(base, { recursive: true })
  return join(base, 'kundenfinder.db')
}

let _db: Database.Database | null = null

/** Öffnet (einmalig) die DB und stellt sicher, dass das Schema existiert. */
export function getDb(): Database.Database {
  if (_db) return _db
  const db = new Database(dbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  migrateV2(db)
  migrateV3(db)
  migrateAuth(db)
  migrateFiles(db)
  _db = db
  return db
}

/**
 * Additive Migration (Workspace-Dateien): Ordner, Dateien, Versionen, Papierkorb.
 *
 * Wichtig: `storage_key` ist eine serverseitig erzeugte UUID, NIE ein vom Benutzer gelieferter
 * Pfad oder Name. Dadurch ist Path-Traversal strukturell ausgeschlossen — der Originalname lebt
 * ausschließlich als Datenfeld in `name`.
 */
function migrateFiles(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_norm TEXT NOT NULL,
    created_by TEXT REFERENCES app_users(id),
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    deleted_by TEXT REFERENCES app_users(id)
  );
  -- Innerhalb eines Ordners darf ein Name nur einmal vorkommen (gelöschte ausgenommen).
  CREATE UNIQUE INDEX IF NOT EXISTS ux_folders_sibling
    ON folders(IFNULL(parent_id,''), name_norm) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS ix_folders_parent ON folders(parent_id);

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_norm TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    -- serverseitige UUID; der Ablageort auf der Platte leitet sich NUR hieraus ab
    storage_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    sha256 TEXT,
    created_by TEXT REFERENCES app_users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES app_users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    deleted_by TEXT REFERENCES app_users(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_files_sibling
    ON files(IFNULL(folder_id,''), name_norm) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS ix_files_folder ON files(folder_id);
  CREATE INDEX IF NOT EXISTS ix_files_deleted ON files(deleted_at);

  -- Jede Version bleibt als eigene Datei auf der Platte erhalten. Wiederherstellen erzeugt eine
  -- NEUE Version aus einer alten, überschreibt die Historie also nicht.
  CREATE TABLE IF NOT EXISTS file_versions (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime TEXT NOT NULL,
    sha256 TEXT,
    comment TEXT,
    created_by TEXT REFERENCES app_users(id),
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_file_versions ON file_versions(file_id, version);
  CREATE INDEX IF NOT EXISTS ix_file_versions_file ON file_versions(file_id);
  `)
}

/**
 * Additive Migration (Anmeldung & Zugriffsschutz): Benutzer, zweite Sicherheitsfreigabe, Audit-Log.
 * Niemals löschen; bestehende Kundenfinder-Daten bleiben unberührt.
 */
function migrateAuth(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE,
    email TEXT NOT NULL,
    email_norm TEXT,
    email_verified INTEGER DEFAULT 0,
    name TEXT,
    picture TEXT,
    role TEXT NOT NULL DEFAULT 'member',      -- 'admin' | 'member' | 'viewer'
    status TEXT NOT NULL DEFAULT 'invited',   -- 'invited' | 'active' | 'blocked' | 'deactivated' | 'revoked'
    token_version INTEGER NOT NULL DEFAULT 0, -- Erhöhen widerruft alle bestehenden Sessions des Benutzers
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    last_activity_at TEXT,
    approved_by TEXT,
    approved_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_app_users_emailnorm ON app_users(email_norm) WHERE email_norm IS NOT NULL AND email_norm <> '';
  CREATE INDEX IF NOT EXISTS ix_app_users_status ON app_users(status);

  -- Zweite interne Sicherheitsfreigabe (Passwortsperre nach Google-Login).
  CREATE TABLE IF NOT EXISTS security_access_password (
    id INTEGER PRIMARY KEY CHECK (id = 1),   -- Singleton
    password_hash TEXT,
    password_version INTEGER NOT NULL DEFAULT 1,
    gate_epoch INTEGER NOT NULL DEFAULT 1,    -- Erhöhen widerruft ALLE zweiten Freigaben
    is_active INTEGER NOT NULL DEFAULT 0,
    is_development_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    activated_at TEXT,
    changed_by_user_id TEXT
  );
  INSERT OR IGNORE INTO security_access_password (id, password_version, gate_epoch, is_active, is_development_password) VALUES (1, 1, 1, 0, 0);

  -- Sicherheits-/Aktivitätsprotokoll (nicht über normale UI löschbar).
  CREATE TABLE IF NOT EXISTS auth_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    user_id TEXT,
    email TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    ip_hash TEXT,
    meta TEXT
  );
  CREATE INDEX IF NOT EXISTS ix_audit_at ON auth_audit_log(at);
  CREATE INDEX IF NOT EXISTS ix_audit_user ON auth_audit_log(user_id);
  `)
}

/**
 * Additive Migration (Personen- & Entscheider-Recherche): neue Tabellen + Rollup-Spalten.
 * Niemals löschen; bestehende Daten und der Dubletten-Schutz bleiben unverändert.
 */
function migrateV3(db: Database.Database) {
  const cols = new Set((db.prepare('PRAGMA table_info(companies)').all() as { name: string }[]).map((r) => r.name))
  const add = (name: string, def: string) => {
    if (!cols.has(name)) db.exec(`ALTER TABLE companies ADD COLUMN ${name} ${def}`)
  }
  // Denormalisierte Rollups aus den gefundenen Personen (für Lead-Tabelle & Filter)
  add('preferred_person_id', 'TEXT')
  add('preferred_person_name', 'TEXT')
  add('preferred_person_role', 'TEXT')
  add('decision_relevance', 'TEXT') // 'sehr_hoch' | 'hoch' | 'mittel' | 'unbekannt'
  add('has_decision_maker', 'INTEGER DEFAULT 0')
  add('has_direct_phone', 'INTEGER DEFAULT 0')
  add('has_business_mobile', 'INTEGER DEFAULT 0')
  add('has_direct_email', 'INTEGER DEFAULT 0')
  add('people_count', 'INTEGER DEFAULT 0')
  add('people_researched_at', 'TEXT')

  db.exec(`
  CREATE TABLE IF NOT EXISTS company_people (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    name_norm TEXT,
    salutation TEXT,
    first_name TEXT,
    last_name TEXT,
    title TEXT,
    role TEXT,
    roles TEXT,               -- JSON-Array aller gefundenen Rollen
    department TEXT,
    is_owner INTEGER DEFAULT 0,
    is_founder INTEGER DEFAULT 0,
    is_managing_director INTEGER DEFAULT 0,
    is_shareholder INTEGER DEFAULT 0,
    is_decision_maker INTEGER DEFAULT 0,
    decision_relevance TEXT DEFAULT 'unbekannt',
    decision_score INTEGER DEFAULT 0,
    is_preferred_contact INTEGER DEFAULT 0,
    confidence_level TEXT DEFAULT 'mittel',
    contact_status TEXT DEFAULT 'zu_pruefen',
    note TEXT,
    note_edited INTEGER DEFAULT 0,
    source TEXT,
    source_url TEXT,
    first_seen_at TEXT NOT NULL,
    last_verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_people_company ON company_people(company_id);
  CREATE INDEX IF NOT EXISTS ix_people_namenorm ON company_people(company_id, name_norm);

  CREATE TABLE IF NOT EXISTS person_contact_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    kind TEXT NOT NULL,          -- phone | mobile | email | fax | profile
    phone_type TEXT,
    value TEXT NOT NULL,
    normalized_value TEXT,
    is_direct INTEGER DEFAULT 0,
    is_mobile INTEGER DEFAULT 0,
    is_business_published INTEGER DEFAULT 0,
    mobile_confidence TEXT,
    is_preferred INTEGER DEFAULT 0,
    source TEXT,
    source_url TEXT,
    verified_at TEXT,
    verification_status TEXT DEFAULT 'unbestaetigt',
    created_at TEXT NOT NULL,
    FOREIGN KEY(person_id) REFERENCES company_people(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_cm_person ON person_contact_methods(person_id);
  CREATE INDEX IF NOT EXISTS ix_cm_company ON person_contact_methods(company_id);
  -- Dubletten-Schutz für Kontaktmethoden je Person (gleicher normalisierter Wert nicht doppelt)
  CREATE UNIQUE INDEX IF NOT EXISTS ux_cm_person_val ON person_contact_methods(person_id, kind, normalized_value)
    WHERE normalized_value IS NOT NULL AND normalized_value <> '';

  CREATE TABLE IF NOT EXISTS person_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    source TEXT,
    source_url TEXT,
    source_quality TEXT DEFAULT 'mittel',
    snippet TEXT,
    found_at TEXT NOT NULL,
    FOREIGN KEY(person_id) REFERENCES company_people(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_psrc_person ON person_sources(person_id);

  CREATE TABLE IF NOT EXISTS person_research_runs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    pages_checked TEXT,
    people_found INTEGER DEFAULT 0,
    contacts_found INTEGER DEFAULT 0,
    status TEXT DEFAULT 'laufend',
    log TEXT,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_prun_company ON person_research_runs(company_id);

  CREATE TABLE IF NOT EXISTS person_data_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    person_id TEXT,
    field TEXT NOT NULL,
    value_a TEXT,
    value_b TEXT,
    source_a TEXT,
    source_b TEXT,
    resolved INTEGER DEFAULT 0,
    at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_conflict_company ON person_data_conflicts(company_id);
  `)
}

/** Additive Migration (Phase 2): neue Spalten/Tabellen – niemals löschen, bestehende Daten bleiben. */
function migrateV2(db: Database.Database) {
  const cols = new Set((db.prepare('PRAGMA table_info(companies)').all() as { name: string }[]).map((r) => r.name))
  const add = (name: string, def: string) => {
    if (!cols.has(name)) db.exec(`ALTER TABLE companies ADD COLUMN ${name} ${def}`)
  }
  add('contact_completeness', 'TEXT') // 'vollstaendig' | 'teilweise' | 'keine'
  add('acquisition_priority', 'TEXT') // 'A' | 'B' | 'C' | 'D'
  add('acquisition_score', 'INTEGER')
  add('acquisition_reason', 'TEXT')
  add('ai_website_note', 'TEXT')
  add('ai_note_generated_at', 'TEXT')
  add('ai_note_edited', 'INTEGER DEFAULT 0')
  add('last_activity_at', 'TEXT')
  db.exec(`
  CREATE INDEX IF NOT EXISTS ix_companies_priority ON companies(acquisition_priority);
  CREATE INDEX IF NOT EXISTS ix_companies_contact ON companies(contact_completeness);
  CREATE INDEX IF NOT EXISTS ix_companies_potential ON companies(website_score);
  CREATE INDEX IF NOT EXISTS ix_companies_lastact ON companies(last_activity_at);

  CREATE TABLE IF NOT EXISTS company_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    type TEXT NOT NULL,
    note TEXT,
    next_step TEXT,
    followup TEXT,
    user TEXT,
    at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_activities_company ON company_activities(company_id);

  CREATE TABLE IF NOT EXISTS saved_filter_views (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT,
    params TEXT,
    created_at TEXT NOT NULL
  );
  `)
}

function migrate(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_norm TEXT,
    rechtsform TEXT,
    industry TEXT,
    description TEXT,
    street TEXT,
    house_number TEXT,
    plz TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    lat REAL,
    lng REAL,
    website TEXT,
    domain_norm TEXT,
    phone TEXT,
    phone_norm TEXT,
    email TEXT,
    email_norm TEXT,
    contact_name TEXT,
    contact_position TEXT,
    contact_email TEXT,
    social TEXT,
    opening_hours TEXT,
    rating REAL,
    rating_count INTEGER,
    source TEXT,
    external_id TEXT,
    external_provider TEXT,
    status TEXT NOT NULL DEFAULT 'neu',
    priority TEXT,
    assignee TEXT,
    tags TEXT,
    next_step TEXT,
    followup_date TEXT,
    last_contact_at TEXT,
    website_score INTEGER,
    website_reasons TEXT,
    lead_score INTEGER,
    lead_label TEXT,
    lead_reasons TEXT,
    fingerprint TEXT,
    excluded INTEGER NOT NULL DEFAULT 0,
    exclusion_reason TEXT,
    saved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Dubletten-Schutz: partielle UNIQUE-Indizes (NULL/'' erlaubt Mehrfaches, echte Werte sind eindeutig)
  CREATE UNIQUE INDEX IF NOT EXISTS ux_companies_domain ON companies(domain_norm) WHERE domain_norm IS NOT NULL AND domain_norm <> '';
  CREATE UNIQUE INDEX IF NOT EXISTS ux_companies_phone ON companies(phone_norm) WHERE phone_norm IS NOT NULL AND phone_norm <> '';
  CREATE UNIQUE INDEX IF NOT EXISTS ux_companies_email ON companies(email_norm) WHERE email_norm IS NOT NULL AND email_norm <> '';
  CREATE UNIQUE INDEX IF NOT EXISTS ux_companies_ext ON companies(external_provider, external_id) WHERE external_id IS NOT NULL AND external_id <> '';
  CREATE UNIQUE INDEX IF NOT EXISTS ux_companies_fp ON companies(fingerprint) WHERE fingerprint IS NOT NULL AND fingerprint <> '';
  CREATE INDEX IF NOT EXISTS ix_companies_status ON companies(status);
  CREATE INDEX IF NOT EXISTS ix_companies_city ON companies(city);
  CREATE INDEX IF NOT EXISTS ix_companies_name_norm ON companies(name_norm);
  CREATE INDEX IF NOT EXISTS ix_companies_saved ON companies(saved);
  CREATE INDEX IF NOT EXISTS ix_companies_excluded ON companies(excluded);

  CREATE TABLE IF NOT EXISTS company_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    source TEXT,
    source_url TEXT,
    external_id TEXT,
    provider TEXT,
    found_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_sources_company ON company_sources(company_id);

  CREATE TABLE IF NOT EXISTS website_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    url TEXT,
    reachable INTEGER,
    https INTEGER,
    score INTEGER,
    breakdown TEXT,
    issues TEXT,
    screenshot TEXT,
    analyzed_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_analyses_company ON website_analyses(company_id);

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_notes_company ON notes(company_id);

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    assignee TEXT,
    priority TEXT,
    status TEXT NOT NULL DEFAULT 'offen',
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_tasks_company ON tasks(company_id);
  CREATE INDEX IF NOT EXISTS ix_tasks_due ON tasks(due_date);

  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    user TEXT,
    at TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_history_company ON status_history(company_id);

  CREATE TABLE IF NOT EXISTS search_runs (
    id TEXT PRIMARY KEY,
    params TEXT,
    area TEXT,
    industry TEXT,
    provider TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    found INTEGER DEFAULT 0,
    neu INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    excluded INTEGER DEFAULT 0,
    saved INTEGER DEFAULT 0,
    errors TEXT,
    status TEXT NOT NULL DEFAULT 'laufend'
  );

  CREATE TABLE IF NOT EXISTS search_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    company_id TEXT,
    is_new INTEGER,
    dup_status TEXT,
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_results_run ON search_results(run_id);

  CREATE TABLE IF NOT EXISTS exclusion_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    reason TEXT,
    user TEXT,
    at TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS ix_exclusion_company ON exclusion_entries(company_id);
  `)
}

/** NUR für Tests: schließt und löscht die DB-Referenz (nicht die Datei). */
export function _resetDbForTests() {
  try {
    _db?.close()
  } catch {}
  _db = null
}
