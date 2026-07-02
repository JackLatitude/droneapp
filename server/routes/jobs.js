import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const countriesPath = join(__dirname, '../../knowledge/countries.json');

function loadCountries() {
  return JSON.parse(readFileSync(countriesPath, 'utf8'));
}

function parseJobJson(job) {
  if (!job) return null;
  return {
    ...job,
    airspace_users: JSON.parse(job.airspace_users || '[]'),
    area_of_operations: job.area_of_operations ? JSON.parse(job.area_of_operations) : null,
  };
}

const router = Router();

router.get('/', (req, res) => {
  const { status, country, client_id } = req.query;
  let sql = `SELECT j.*, c.name as client_name FROM jobs j LEFT JOIN clients c ON c.id = j.client_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND j.status = ?'; params.push(status); }
  if (country) { sql += ' AND j.country = ?'; params.push(country); }
  if (client_id) { sql += ' AND j.client_id = ?'; params.push(client_id); }
  sql += ' ORDER BY j.start_date DESC, j.created_at DESC';
  res.json(getDb().prepare(sql).all(...params).map(parseJobJson));
});

router.get('/:id', (req, res) => {
  const job = getDb().prepare('SELECT j.*, c.name as client_name FROM jobs j LEFT JOIN clients c ON c.id = j.client_id WHERE j.id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(parseJobJson(job));
});

router.post('/', (req, res) => {
  const db = getDb();
  const {
    title, client_id, description, operation_type = 'UK_PDRA01',
    country = 'uk', start_date, start_time, end_time,
    location_name, location_address, lat, lng, elevation_ft,
    airspace_class, aircraft_id, notes
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const id = crypto.randomUUID();

  const createJob = db.transaction(() => {
    db.prepare(`
      INSERT INTO jobs (id, client_id, title, description, operation_type, country,
        start_date, start_time, end_time, location_name, location_address,
        lat, lng, elevation_ft, airspace_class, aircraft_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, client_id || null, title, description || null, operation_type, country,
      start_date || null, start_time || null, end_time || null,
      location_name || null, location_address || null,
      lat || null, lng || null, elevation_ft || null,
      airspace_class || null, aircraft_id || null, notes || null);

    // Seed permissions from countries.json
    const countries = loadCountries();
    const countryData = countries[country.toLowerCase()];
    if (countryData?.permissions) {
      const insertPerm = db.prepare(`
        INSERT INTO job_permissions (id, job_id, label, authority, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      countryData.permissions.forEach((p, i) => {
        insertPerm.run(crypto.randomUUID(), id, p.label, p.authority || null, p.notes || null, i);
      });
    }
  });

  createJob();
  res.status(201).json(parseJobJson(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    title, client_id, description, status, operation_type, country,
    start_date, start_time, end_time, location_name, location_address,
    lat, lng, elevation_ft, airspace_class, airspace_users,
    area_of_operations, map_static_image_url, ground_risk_summary,
    aircraft_id, notes, method_statement
  } = req.body;

  db.prepare(`
    UPDATE jobs SET
      title=?, client_id=?, description=?, status=?, operation_type=?, country=?,
      start_date=?, start_time=?, end_time=?, location_name=?, location_address=?,
      lat=?, lng=?, elevation_ft=?, airspace_class=?,
      airspace_users=?, area_of_operations=?, map_static_image_url=?,
      ground_risk_summary=?, aircraft_id=?, notes=?, method_statement=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    title, client_id || null, description || null, status || 'new', operation_type || 'UK_PDRA01', country || 'uk',
    start_date || null, start_time || null, end_time || null, location_name || null, location_address || null,
    req.body.lat !== undefined ? req.body.lat : null,
    req.body.lng !== undefined ? req.body.lng : null,
    req.body.elevation_ft !== undefined ? req.body.elevation_ft : null,
    airspace_class || null,
    airspace_users ? JSON.stringify(airspace_users) : '[]',
    area_of_operations ? JSON.stringify(area_of_operations) : null,
    map_static_image_url || null, ground_risk_summary || null, aircraft_id || null, notes || null,
    method_statement || null,
    req.params.id
  );
  res.json(parseJobJson(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
