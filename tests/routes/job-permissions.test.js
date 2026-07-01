import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db, jobId;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
  // Create a job directly in DB
  jobId = crypto.randomUUID();
  db.prepare(`INSERT INTO jobs (id, title, country, operation_type) VALUES (?, ?, ?, ?)`).run(jobId, 'Test Job', 'uk', 'UK_PDRA01');
  db.prepare(`INSERT INTO job_permissions (id, job_id, label, sort_order) VALUES (?, ?, ?, ?)`).run(crypto.randomUUID(), jobId, 'Drone Assist', 0);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Job Permissions API', () => {
  it('GET returns permissions', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}/permissions`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].label).toBe('Drone Assist');
  });

  it('PUT updates permission status', async () => {
    const existing = db.prepare('SELECT * FROM job_permissions WHERE job_id = ?').all(jobId);
    const updated = existing.map(p => ({ ...p, status: 'obtained' }));
    const res = await request(app).put(`/api/jobs/${jobId}/permissions`).auth(AUTH.user, AUTH.pass).send(updated);
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('obtained');
  });

  it('POST adds a custom permission', async () => {
    const res = await request(app).post(`/api/jobs/${jobId}/permissions`).auth(AUTH.user, AUTH.pass).send({ label: 'Custom item' });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Custom item');
  });
});
