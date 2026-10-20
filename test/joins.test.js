import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOURCES } from '../src/sources.js';
import { buildUpsertSql, toBindings, validateRows } from '../src/ingest.js';

// End-to-end through the real pipeline pieces: rows are validated and
// normalised exactly as the Worker does, written with the generated upsert
// into SQLite (the engine under D1), then read back through the views.
// Needs node:sqlite (Node 22.5+); skipped on older Node.
let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  DatabaseSync = undefined;
}
const skip = DatabaseSync ? false : 'node:sqlite is not available on this Node version';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function load(db, sourceName, rows) {
  const source = SOURCES[sourceName];
  const result = validateRows(source, rows);
  assert.equal(result.ok, true, result.error);
  const statement = db.prepare(buildUpsertSql(source));
  for (const row of result.rows) statement.run(...toBindings(source, row));
}

function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(read('schema.sql'));
  db.exec(read('views.sql'));

  // One page, written three different ways by three different sources.
  load(db, 'web_traffic_daily', [
    { date: '2026-09-01', page_path: '/es/pricing/?utm_source=x', channel: 'Organic Search', device: 'mobile', sessions: 10, engaged_sessions: 6, key_events: 1 },
    { date: '2026-09-01', page_path: '/es/pricing', channel: 'Direct', device: 'desktop', sessions: 5, engaged_sessions: 4, key_events: 0 },
    { date: '2026-09-02', page_path: '/es/blog', channel: 'Organic Search', device: 'mobile', sessions: 80, engaged_sessions: 30, key_events: 0 },
  ]);
  load(db, 'search_queries_daily', [
    { date: '2026-09-01', query: 'pricing plans compared', page_path: 'https://www.example.com/es/Pricing', country: 'es', clicks: 3, impressions: 100 },
    { date: '2026-09-01', query: 'plans and prices', page_path: 'https://www.example.com/es/Pricing', country: 'es', clicks: 4, impressions: 200 },
  ]);
  load(db, 'lead_outcomes_daily', [
    { date: '2026-09-01', page_path: 'https://example.com/es/pricing#form', status: 'won', leads: 1, value_eur: 500 },
    { date: '2026-09-01', page_path: 'https://example.com/es/pricing', status: 'open', leads: 2, value_eur: 0 },
  ]);
  return db;
}

test('one page from three sources lands on one row with every metric', { skip }, () => {
  const db = freshDatabase();
  const row = db.prepare(
    "SELECT * FROM v_page_funnel_daily WHERE date = '2026-09-01' AND page_path = '/es/pricing'"
  ).get();
  assert.equal(row.clicks, 7);
  assert.equal(row.impressions, 300);
  assert.equal(row.sessions, 15);
  assert.equal(row.engaged_sessions, 10);
  assert.equal(row.leads, 3);
  assert.equal(row.won_leads, 1);
  assert.equal(row.won_value_eur, 500);
});

test('a page present in only one source is kept, with zeros elsewhere', { skip }, () => {
  const db = freshDatabase();
  const row = db.prepare(
    "SELECT * FROM v_page_funnel_daily WHERE date = '2026-09-02' AND page_path = '/es/blog'"
  ).get();
  assert.equal(row.sessions, 80);
  assert.equal(row.clicks, 0);
  assert.equal(row.leads, 0);
});

test('the view returns exactly one row per day and page', { skip }, () => {
  const db = freshDatabase();
  const { n, unique_keys: uniqueKeys } = db.prepare(
    'SELECT COUNT(*) AS n, COUNT(DISTINCT date || page_path) AS unique_keys FROM v_page_funnel_daily'
  ).get();
  assert.equal(n, uniqueKeys);
  assert.equal(n, 2);
});

test('the trap: joining the raw tables directly inflates the totals', { skip }, () => {
  const db = freshDatabase();

  // The tempting query: join traffic to search on day and page.
  const naive = db.prepare(`
    SELECT SUM(t.sessions) AS sessions
    FROM web_traffic_daily t
    JOIN search_queries_daily s ON s.date = t.date AND s.page_path = t.page_path
    WHERE t.date = '2026-09-01' AND t.page_path = '/es/pricing'
  `).get();

  const correct = db.prepare(
    "SELECT sessions FROM v_page_funnel_daily WHERE date = '2026-09-01' AND page_path = '/es/pricing'"
  ).get();

  assert.equal(correct.sessions, 15);
  assert.equal(naive.sessions, 30); // each traffic row repeated once per search query
});

test('the sample queries run against the views', { skip }, () => {
  const db = freshDatabase();
  for (const file of ['top-pages-by-won-value', 'traffic-without-leads', 'tracking-sanity-check']) {
    assert.doesNotThrow(() => db.prepare(read(`queries/${file}.sql`)).all(), file);
  }
  const top = db.prepare(read('queries/top-pages-by-won-value.sql')).all();
  assert.equal(top[0].page_path, '/es/pricing');
  assert.equal(top[0].won_value_eur, 500);
});

test('re-sending a day leaves one set of rows (idempotent end to end)', { skip }, () => {
  const db = freshDatabase();
  load(db, 'lead_outcomes_daily', [
    { date: '2026-09-01', page_path: '/es/pricing', status: 'open', leads: 2, value_eur: 0 },
  ]);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM lead_outcomes_daily WHERE status = 'open'").get();
  assert.equal(n, 1);
});
