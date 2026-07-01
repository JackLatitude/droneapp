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

afterAll(() => {
  setDb(null);
  closeTestDb(db);
});

it('GET /api/settings returns seeded row', async () => {
  const res = await request(app).get('/api/settings').auth(AUTH.user, AUTH.pass);
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Jack Downes');
});

it('PUT /api/settings updates name', async () => {
  const res = await request(app).put('/api/settings').auth(AUTH.user, AUTH.pass).send({ name: 'J. Downes' });
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('J. Downes');
});

it('GET /api/countries returns all countries', async () => {
  const res = await request(app).get('/api/countries').auth(AUTH.user, AUTH.pass);
  expect(res.status).toBe(200);
  expect(res.body.uk).toBeDefined();
  expect(res.body.us).toBeDefined();
});
