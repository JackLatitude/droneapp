import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  const perms = getDb().prepare(
    'SELECT * FROM job_permissions WHERE job_id = ? ORDER BY sort_order ASC'
  ).all(req.params.id);
  res.json(perms);
});

// PUT replaces the full list (status updates from frontend)
router.put('/', (req, res) => {
  const db = getDb();
  const perms = req.body; // array of { id, status, contact, deadline, notes }
  if (!Array.isArray(perms)) return res.status(400).json({ error: 'Expected array' });

  const update = db.prepare(`
    UPDATE job_permissions SET status=?, contact=?, deadline=?, notes=? WHERE id=? AND job_id=?
  `);
  const updateAll = db.transaction(() => {
    perms.forEach(p => update.run(p.status || 'pending', p.contact || null, p.deadline || null, p.notes || null, p.id, req.params.id));
  });
  updateAll();
  res.json(db.prepare('SELECT * FROM job_permissions WHERE job_id = ? ORDER BY sort_order').all(req.params.id));
});

// POST adds a custom permission item
router.post('/', (req, res) => {
  const { label, authority, notes } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM job_permissions WHERE job_id = ?').get(req.params.id);
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO job_permissions (id, job_id, label, authority, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, req.params.id, label, authority || null, notes || null, (maxOrder.m || 0) + 1);
  res.status(201).json(db.prepare('SELECT * FROM job_permissions WHERE id = ?').get(id));
});

router.delete('/:permId', (req, res) => {
  const result = getDb().prepare('DELETE FROM job_permissions WHERE id = ? AND job_id = ?').run(req.params.permId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
