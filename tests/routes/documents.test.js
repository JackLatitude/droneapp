import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db, jobId, docId;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
  jobId = crypto.randomUUID();
  db.prepare(`INSERT INTO jobs (id, title, country, operation_type, description, location_name) VALUES (?, ?, ?, ?, ?, ?)`).run(
    jobId, 'Test RAMS Job', 'uk', 'UK_PDRA01', 'Cinematic aerial for BBC production', 'Wembley Stadium'
  );
  db.prepare(`INSERT INTO job_risks (id, job_id, sort_order, hazard, cause, consequence, severity, probability, mitigations, residual_severity, residual_probability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(), jobId, 1, 'Loss of control link', 'RF interference', 'Flyaway', 4, 2, 'RTH configured', 2, 1
  );
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Documents API', () => {
  it('POST /api/documents generates a document', async () => {
    const res = await request(app).post('/api/documents').auth(AUTH.user, AUTH.pass).send({ job_id: jobId });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(1);
    docId = res.body.id;
  });

  it('GET /api/documents/:id/html returns HTML', async () => {
    const res = await request(app).get(`/api/documents/${docId}/html`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Test RAMS Job');
    expect(res.text).toContain('Loss of control link');
    expect(res.text).toContain('Jack Downes');
  });

  it('second generation increments version', async () => {
    const res = await request(app).post('/api/documents').auth(AUTH.user, AUTH.pass).send({ job_id: jobId });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
  });

  it('GET /api/documents/job/:jobId lists documents', async () => {
    const res = await request(app).get(`/api/documents/job/${jobId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});
