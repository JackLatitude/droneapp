import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  db = createTestDb();
  setDb(db);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Clients API', () => {
  let clientId;

  it('POST /api/clients creates a client', async () => {
    const res = await request(app)
      .post('/api/clients')
      .auth(AUTH.user, AUTH.pass)
      .send({ name: 'BBC Studios', contact_name: 'Sarah Jones', email: 'sarah@bbc.co.uk' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('BBC Studios');
    clientId = res.body.id;
  });

  it('GET /api/clients returns the created client', async () => {
    const res = await request(app).get('/api/clients').auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.find(c => c.id === clientId)).toBeTruthy();
  });

  it('GET /api/clients/:id returns the client', async () => {
    const res = await request(app).get(`/api/clients/${clientId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('sarah@bbc.co.uk');
  });

  it('PUT /api/clients/:id updates the client', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ name: 'BBC Studios Updated', email: 'new@bbc.co.uk' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('BBC Studios Updated');
  });

  it('DELETE /api/clients/:id archives the client', async () => {
    const res = await request(app).delete(`/api/clients/${clientId}`).auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Should not appear in list
    const list = await request(app).get('/api/clients').auth(AUTH.user, AUTH.pass);
    expect(list.body.find(c => c.id === clientId)).toBeFalsy();
  });

  it('POST returns 400 if name missing', async () => {
    const res = await request(app).post('/api/clients').auth(AUTH.user, AUTH.pass).send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });
});
