import Database from 'better-sqlite3';
const db = new Database(':memory:');
const stmt = db.prepare('SELECT 1 as x');
const row = stmt.get();
// row should be any if the augmentation works
const y = row.x;
