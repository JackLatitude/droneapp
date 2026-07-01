import Database from 'better-sqlite3';
import { initDb } from '../server/db.js';

export function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  initDb(db);
  return db;
}

export function closeTestDb(db) {
  db.close();
}
