import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let _db;

export function getDb() {
  if (!_db) {
    const path = process.env.DB_PATH || join(__dirname, '../drone-ops.db');
    _db = new Database(path);
    _db.pragma('journal_mode = WAL');
    initDb(_db);
  }
  return _db;
}

export function setDb(db) {
  _db = db;
}

export function initDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT, email TEXT, phone TEXT,
      operator_id TEXT, flyer_id TEXT, flyer_id_expiry TEXT,
      pdra01_ref TEXT, pdra01_expiry TEXT,
      gvc_ref TEXT, gvc_expiry TEXT,
      faa_part107_ref TEXT, faa_part107_expiry TEXT,
      iau_ref TEXT, iau_expiry TEXT,
      document_logo_path TEXT,
      document_accent_colour TEXT DEFAULT '#1d4ed8',
      ai_style_prompt TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT, email TEXT, phone TEXT,
      address TEXT, notes TEXT,
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS aircraft (
      id TEXT PRIMARY KEY,
      make TEXT NOT NULL, model TEXT NOT NULL,
      identifier TEXT,
      weight_g INTEGER, diagonal_mm INTEGER,
      max_wind_ms REAL, kinetic_energy_kj REAL,
      prop_protection TEXT, notes TEXT,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      client_id TEXT REFERENCES clients(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'new',
      operation_type TEXT DEFAULT 'UK_PDRA01',
      country TEXT DEFAULT 'uk',
      start_date TEXT, start_time TEXT, end_time TEXT,
      location_name TEXT, location_address TEXT,
      lat REAL, lng REAL, elevation_ft INTEGER,
      airspace_class TEXT,
      airspace_users TEXT DEFAULT '[]',
      area_of_operations TEXT,
      map_static_image_url TEXT,
      ground_risk_summary TEXT,
      aircraft_id TEXT REFERENCES aircraft(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_permissions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      authority TEXT, contact TEXT, deadline TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS job_risks (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      hazard TEXT, cause TEXT, consequence TEXT,
      severity INTEGER DEFAULT 3, probability INTEGER DEFAULT 3,
      mitigations TEXT, residual_severity INTEGER, residual_probability INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      version INTEGER DEFAULT 1,
      html_snapshot TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed settings row if absent
  const hasSettings = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!hasSettings) {
    db.prepare(`INSERT INTO settings (id, name, operator_id, flyer_id, pdra01_ref, gvc_ref, faa_part107_ref, iau_ref)
      VALUES (1, 'Jack Downes', 'GBR-OP-R3PNNYZFTPJJ', 'GBR-RP-CM4W8MR2V43L',
              'PDRA01-23281', 'GVC/ICARUS', 'FAA Part 107', 'IRL-RP-000008146ZAC')`).run();
  }

  // Seed aircraft fleet if absent
  const hasAircraft = db.prepare('SELECT id FROM aircraft LIMIT 1').get();
  if (!hasAircraft) {
    const insert = db.prepare(`INSERT INTO aircraft
      (id, make, model, identifier, weight_g, diagonal_mm, max_wind_ms, kinetic_energy_kj, prop_protection)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const fleet = [
      [crypto.randomUUID(), 'DJI', 'Inspire 3', 'INSPIRE3-01', 3995, 605, 12, 7.8, 'None'],
      [crypto.randomUUID(), 'DJI', 'Mavic 3E', 'MAVIC3E-01', 915, 380, 12, 0.5, 'None'],
      [crypto.randomUUID(), 'DJI', 'Mini 3 Pro', 'MINI3P-01', 249, 251, 10.7, 0.14, 'None'],
      [crypto.randomUUID(), 'DJI', 'Mini 5 Pro', 'MINI5P-01', 299, 255, 10.7, 0.17, 'None'],
      [crypto.randomUUID(), 'DJI', 'Avata 2', 'AVATA2-01', 377, 180, 8, 0.14, 'Integrated ducts'],
    ];
    const seedAll = db.transaction(() => fleet.forEach(f => insert.run(...f)));
    seedAll();
  }
}
