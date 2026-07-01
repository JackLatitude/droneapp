import request from 'supertest';
import { app } from '../../server/index.js';
import { createTestDb, closeTestDb } from '../helpers.js';
import { setDb } from '../../server/db.js';

const AUTH = { user: 'jack', pass: 'test' };
let db;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  // No OPENAIP_API_KEY set — only NHS hospitals will return
  delete process.env.OPENAIP_API_KEY;
  db = createTestDb();
  setDb(db);
});
afterAll(() => { setDb(null); closeTestDb(db); });

describe('Airspace API', () => {
  it('returns 400 if lat/lng missing', async () => {
    const res = await request(app).get('/api/airspace').auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(400);
  });

  it('returns hospital data for London coords', async () => {
    const res = await request(app)
      .get('/api/airspace?lat=51.5074&lng=-0.1278&radius_km=10')
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hospitals');
    expect(res.body).toHaveProperty('aerodromes');
    expect(res.body).toHaveProperty('airspaceZones');
    // At least some London hospitals within 10km
    expect(res.body.hospitals.length).toBeGreaterThan(0);
  });

  it('filters hospitals by radius', async () => {
    // Edinburgh coords — no London hospitals within 5km
    const res = await request(app)
      .get('/api/airspace?lat=55.9533&lng=-3.1883&radius_km=5')
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.body.hospitals.length).toBe(0);
  });
});
