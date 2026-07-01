import { createTestDb, closeTestDb } from './helpers.js';

describe('DB schema', () => {
  let db;
  beforeAll(() => { db = createTestDb(); });
  afterAll(() => closeTestDb(db));

  it('creates all tables', () => {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ).all().map(r => r.name);
    expect(tables).toEqual(expect.arrayContaining([
      'aircraft','clients','documents','job_permissions','job_risks','jobs','settings'
    ]));
  });

  it('seeds settings row', () => {
    const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    expect(s.name).toBe('Jack Downes');
    expect(s.operator_id).toBe('GBR-OP-R3PNNYZFTPJJ');
  });

  it('seeds 5 aircraft', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM aircraft').get();
    expect(count.n).toBe(5);
  });
});
