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
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Jobs API', () => {
  it('POST /api/jobs creates a job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .auth(AUTH.user, AUTH.pass)
      .send({ title: 'Gladiators S3 Arena', country: 'uk', operation_type: 'UK_PDRA01' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Gladiators S3 Arena');
    expect(Array.isArray(res.body.airspace_users)).toBe(true);
    jobId = res.body.id;
  });

  it('POST /api/jobs auto-seeds UK permissions', async () => {
    const perms = db.prepare('SELECT * FROM job_permissions WHERE job_id = ?').all(jobId);
    expect(perms.length).toBeGreaterThanOrEqual(3);
    expect(perms.some(p => p.label.includes('Drone Assist'))).toBe(true);
  });

  it('GET /api/jobs returns the job', async () => {
    const res = await request(app).get('/api/jobs').auth(AUTH.user, AUTH.pass);
    expect(res.body.find(j => j.id === jobId)).toBeTruthy();
  });

  it('GET /api/jobs/:id returns full job', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
  });

  it('PUT /api/jobs/:id updates status', async () => {
    const res = await request(app)
      .put(`/api/jobs/${jobId}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ title: 'Gladiators S3 Arena', status: 'planned', country: 'uk', operation_type: 'UK_PDRA01' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('planned');
  });

  it('PUT stores area_of_operations as JSON', async () => {
    const polygon = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };
    const res = await request(app)
      .put(`/api/jobs/${jobId}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ title: 'Gladiators S3 Arena', country: 'uk', operation_type: 'UK_PDRA01', area_of_operations: polygon });
    expect(res.status).toBe(200);
    expect(res.body.area_of_operations).toEqual(polygon);
  });

  it('DELETE /api/jobs/:id deletes the job', async () => {
    const res = await request(app).delete(`/api/jobs/${jobId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
