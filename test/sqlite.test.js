import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOURCES } from '../src/sources.js';
import { buildUpsertSql, toBindings, validateRows } from '../src/ingest.js';

// Runs the real schema and the generated SQL against SQLite itself (the
// engine under D1). Needs the built-in node:sqlite module (Node 22.5+);
// skipped on older Node.
let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  DatabaseSync = undefined;
}
const skip = DatabaseSync ? false : 'node:sqlite is not available on this Node version';

const source = SOURCES.web_traffic_daily;
const row = {
  date: '2026-09-07', landing_page: '/', channel: 'Direct', device: 'desktop',
  sessions: 5, engaged_sessions: 4, key_events: 1,
};

function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  return db;
}

test('re-sending a day updates the row instead of duplicating it', { skip }, () => {
  const db = freshDatabase();
  const statement = db.prepare(buildUpsertSql(source));
  for (const sessions of [5, 8]) {
    const { rows } = validateRows(source, [{ ...row, sessions }]);
    statement.run(...toBindings(source, rows[0]));
  }
  const result = db.prepare('SELECT COUNT(*) AS n, MAX(sessions) AS s FROM web_traffic_daily').get();
  assert.equal(result.n, 1);
  assert.equal(result.s, 8);
});

test('why key dimensions are stored as empty strings: NULLs defeat UNIQUE', { skip }, () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (d TEXT, k TEXT, UNIQUE (d, k))');
  db.exec("INSERT INTO t VALUES ('x', NULL)");
  db.exec("INSERT INTO t VALUES ('x', NULL)");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM t').get().n, 2);

  db.exec('CREATE TABLE u (d TEXT, k TEXT NOT NULL DEFAULT \'\', UNIQUE (d, k))');
  db.exec("INSERT INTO u VALUES ('x', '')");
  assert.throws(() => db.exec("INSERT INTO u VALUES ('x', '')"));
});
