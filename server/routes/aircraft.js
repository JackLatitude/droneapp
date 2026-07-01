import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM aircraft WHERE archived=0 ORDER BY make, model').all();
  res.json(rows);
});

export default router;
