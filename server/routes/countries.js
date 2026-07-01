import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadCountries() {
  return JSON.parse(readFileSync(join(__dirname, '../../knowledge/countries.json'), 'utf8'));
}

const router = Router();

router.get('/', (_req, res) => res.json(loadCountries()));
router.get('/:code', (req, res) => {
  const data = loadCountries()[req.params.code.toLowerCase()];
  if (!data) return res.status(404).json({ error: 'Country not found' });
  res.json(data);
});

export default router;
