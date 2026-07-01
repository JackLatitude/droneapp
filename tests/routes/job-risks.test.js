import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db, jobId, riskId;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
  jobId = crypto.randomUUID();
  db.prepare(`INSERT INTO jobs (id, title, country, operation_type) VALUES (?, ?, ?, ?)`).run(jobId, 'Risk Test Job', 'uk', 'UK_PDRA01');
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Job Risks API', () => {
  it('POST creates a risk', async () => {
    const res = await request(app).post(`/api/jobs/${jobId}/risks`).auth(AUTH.user, AUTH.pass)
      .send({ hazard: 'Loss of control link', cause: 'RF interference', consequence: 'Flyaway', severity: 4, probability: 2, mitigations: 'RTH configured, VLOS maintained', residual_severity: 2, residual_probability: 1 });
    expect(res.status).toBe(201);
    expect(res.body.hazard).toBe('Loss of control link');
    riskId = res.body.id;
  });

  it('GET returns risks', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}/risks`).auth(AUTH.user, AUTH.pass);
    expect(res.body.length).toBe(1);
  });

  it('PUT updates a risk', async () => {
    const res = await request(app).put(`/api/jobs/${jobId}/risks/${riskId}`).auth(AUTH.user, AUTH.pass)
      .send({ hazard: 'Loss of control link', severity: 3, probability: 2, mitigations: 'Updated mitigations' });
    expect(res.status).toBe(200);
    expect(res.body.mitigations).toBe('Updated mitigations');
  });

  it('DELETE removes a risk', async () => {
    const res = await request(app).delete(`/api/jobs/${jobId}/risks/${riskId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    const list = await request(app).get(`/api/jobs/${jobId}/risks`).auth(AUTH.user, AUTH.pass);
    expect(list.body.length).toBe(0);
  });
});
