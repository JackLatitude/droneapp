import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM job_risks WHERE job_id = ? ORDER BY sort_order ASC').all(req.params.id));
});

router.post('/', (req, res) => {
  const db = getDb();
  const { hazard, cause, consequence, severity = 3, probability = 3, mitigations, residual_severity, residual_probability, notes } = req.body;
  if (!hazard) return res.status(400).json({ error: 'hazard is required' });
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM job_risks WHERE job_id = ?').get(req.params.id);
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO job_risks
    (id, job_id, sort_order, hazard, cause, consequence, severity, probability, mitigations, residual_severity, residual_probability, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, req.params.id, (maxOrder.m || 0) + 1,
    hazard, cause || null, consequence || null,
    severity, probability, mitigations || null,
    residual_severity || null, residual_probability || null, notes || null
  );
  res.status(201).json(db.prepare('SELECT * FROM job_risks WHERE id = ?').get(id));
});

// Bulk reorder — must come BEFORE /:riskId to avoid matching "reorder" as riskId
router.put('/reorder', (req, res) => {
  const db = getDb();
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
  const update = db.prepare('UPDATE job_risks SET sort_order=? WHERE id=? AND job_id=?');
  db.transaction(() => items.forEach(i => update.run(i.sort_order, i.id, req.params.id)))();
  res.json({ ok: true });
});

router.put('/:riskId', (req, res) => {
  const db = getDb();
  const { hazard, cause, consequence, severity, probability, mitigations, residual_severity, residual_probability, notes } = req.body;
  const result = db.prepare(`UPDATE job_risks SET
    hazard=?, cause=?, consequence=?, severity=?, probability=?,
    mitigations=?, residual_severity=?, residual_probability=?, notes=?
    WHERE id=? AND job_id=?`).run(
    hazard, cause || null, consequence || null, severity || 3, probability || 3,
    mitigations || null, residual_severity || null, residual_probability || null, notes || null,
    req.params.riskId, req.params.id
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM job_risks WHERE id = ?').get(req.params.riskId));
});

router.delete('/:riskId', (req, res) => {
  const result = getDb().prepare('DELETE FROM job_risks WHERE id = ? AND job_id = ?').run(req.params.riskId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
