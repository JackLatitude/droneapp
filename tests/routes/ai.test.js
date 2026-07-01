import request from 'supertest';
import { jest } from '@jest/globals';

const mockCreate = jest.fn().mockResolvedValue({
  content: [{ text: 'Mocked AI response for testing.' }]
});

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {}
    messages = { create: mockCreate };
  }
}));

// IMPORTANT: dynamic imports AFTER mocking
const { app } = await import('../../server/index.js');
const { setDb } = await import('../../server/db.js');
const { createTestDb, closeTestDb } = await import('../helpers.js');

const AUTH = { user: 'jack', pass: 'test' };
let db;

beforeAll(() => {
  process.env.ADMIN_USER = 'jack';
  process.env.ADMIN_PASS = 'test';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  db = createTestDb();
  setDb(db);
});

afterAll(() => {
  setDb(null);
  closeTestDb(db);
});

describe('AI Routes', () => {
  it('POST /api/ai/ground-risk returns summary', async () => {
    const res = await request(app)
      .post('/api/ai/ground-risk')
      .auth(AUTH.user, AUTH.pass)
      .send({ location_name: 'Wembley Stadium', lat: 51.5560, lng: -0.2796, airspace_class: 'G' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ground_risk_summary');
    expect(typeof res.body.ground_risk_summary).toBe('string');
  });

  it('POST /api/ai/method-statement returns text', async () => {
    const res = await request(app)
      .post('/api/ai/method-statement')
      .auth(AUTH.user, AUTH.pass)
      .send({ job_title: 'Gladiators Arena', operation_type: 'UK_PDRA01', location_name: 'Sheffield Arena', aircraft_model: 'Mavic 3E' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('method_statement');
  });

  it('POST /api/ai/risks returns risks array', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: '[{"hazard":"Loss of control","cause":"Signal loss","consequence":"Injury","severity":4,"probability":2,"mitigations":"Pre-flight checks","residual_severity":2,"residual_probability":1}]' }]
    });
    const res = await request(app)
      .post('/api/ai/risks')
      .auth(AUTH.user, AUTH.pass)
      .send({ job_title: 'Test Job', operation_type: 'UK_PDRA01', location_name: 'Test Site', aircraft_model: 'Mavic 3E' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('risks');
    expect(Array.isArray(res.body.risks)).toBe(true);
  });

  it('returns 503 on AI failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'));
    const res = await request(app)
      .post('/api/ai/ground-risk')
      .auth(AUTH.user, AUTH.pass)
      .send({ location_name: 'Test', lat: 0, lng: 0 });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'AI unavailable', fallback: true });
  });
});
