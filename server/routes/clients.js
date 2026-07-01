import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*, COUNT(j.id) as job_count
    FROM clients c
    LEFT JOIN jobs j ON j.client_id = c.id
    WHERE c.archived = 0
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  res.json(clients);
});

router.get('/:id', (req, res) => {
  const client = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  res.json(client);
});

router.post('/', (req, res) => {
  const { name, contact_name, email, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO clients (id, name, contact_name, email, phone, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, contact_name || null, email || null, phone || null, address || null, notes || null);
  res.status(201).json(getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, contact_name, email, phone, address, notes } = req.body;
  db.prepare(`
    UPDATE clients SET name=?, contact_name=?, email=?, phone=?, address=?, notes=?
    WHERE id=?
  `).run(name, contact_name || null, email || null, phone || null, address || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('UPDATE clients SET archived=1 WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
