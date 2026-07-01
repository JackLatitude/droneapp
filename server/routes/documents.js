import { Router } from 'express';
import { getDb } from '../db.js';
import { generateRams } from '../templates/rams.js';

const router = Router();

router.post('/', (req, res) => {
  const { job_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });
  const db = getDb();

  const job = db.prepare(`
    SELECT j.*, a.model as aircraft_model
    FROM jobs j LEFT JOIN aircraft a ON a.id = j.aircraft_id
    WHERE j.id = ?
  `).get(job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Parse JSON fields
  let airspaceUsers = [];
  try { airspaceUsers = JSON.parse(job.airspace_users || '[]'); } catch {}

  const risks = db.prepare('SELECT * FROM job_risks WHERE job_id = ? ORDER BY sort_order').all(job_id);
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  // Version = max existing + 1
  const maxDoc = db.prepare('SELECT MAX(version) as v FROM documents WHERE job_id = ?').get(job_id);
  const version = (maxDoc?.v || 0) + 1;
  job.doc_version = version;

  const html = generateRams(job, risks, airspaceUsers, settings);
  const id = crypto.randomUUID();

  db.prepare('INSERT INTO documents (id, job_id, version, html_snapshot) VALUES (?, ?, ?, ?)')
    .run(id, job_id, version, html);

  res.status(201).json({ id, job_id, version, created_at: new Date().toISOString() });
});

router.get('/job/:jobId', (req, res) => {
  const docs = getDb().prepare('SELECT id, job_id, version, created_at FROM documents WHERE job_id = ? ORDER BY version DESC').all(req.params.jobId);
  res.json(docs);
});

router.get('/:id/html', (req, res) => {
  const doc = getDb().prepare('SELECT html_snapshot FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'text/html');
  res.send(doc.html_snapshot);
});

export default router;
