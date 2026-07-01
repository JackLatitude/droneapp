import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { basicAuth } from './auth.js';
import clientsRouter from './routes/clients.js';
import jobsRouter from './routes/jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(basicAuth);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Routes mounted in later tasks
app.use('/api/clients', clientsRouter);
app.use('/api/jobs', jobsRouter);

app.use(express.static(join(__dirname, '../public')));
app.use((_req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`drone-ops running on :${port}`));
}
