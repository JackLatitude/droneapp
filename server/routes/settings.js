import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const s = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(s || {});
});

router.put('/', (req, res) => {
  const db = getDb();
  const fields = ['name','email','phone','operator_id','flyer_id','flyer_id_expiry',
    'pdra01_ref','pdra01_expiry','gvc_ref','gvc_expiry',
    'faa_part107_ref','faa_part107_expiry','iau_ref','iau_expiry',
    'document_logo_path','document_accent_colour','ai_style_prompt','mapbox_token'];
  const setClauses = fields.map(f => `${f}=?`).join(', ');
  const values = fields.map(f => req.body[f] ?? null);
  db.prepare(`UPDATE settings SET ${setClauses} WHERE id=1`).run(...values);
  res.json(db.prepare('SELECT * FROM settings WHERE id = 1').get());
});

export default router;
