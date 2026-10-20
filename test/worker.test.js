import test from 'node:test';
import assert from 'node:assert/strict';
import { handleIngest } from '../src/worker.js';

// Minimal stand-in for a D1 binding: records the SQL and the bound values.
function fakeDatabase() {
  const calls = { sql: [], bound: [], batches: 0 };
  return {
    calls,
    prepare(sql) {
      calls.sql.push(sql);
      return {
        bind(...values) {
          calls.bound.push(values);
          return { values };
        },
      };
    },
    async batch(statements) {
      calls.batches += 1;
      return statements;
    },
  };
}

function post(body, token) {
  return new Request('https://ingest.example/', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const row = {
  date: '2026-09-07', page_path: '/', channel: 'Direct', device: 'desktop',
  sessions: 5, engaged_sessions: 4, key_events: 1,
};

function makeEnv() {
  return { DB: fakeDatabase(), INGEST_SECRET_WEB_TRAFFIC: 'traffic-secret', INGEST_SECRET_SEARCH: 'search-secret' };
}

test('writes a batch with the right secret', async () => {
  const env = makeEnv();
  const response = await handleIngest(post({ source: 'web_traffic_daily', rows: [row] }, 'traffic-secret'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, rows: 1 });
  assert.equal(env.DB.calls.batches, 1);
  assert.match(env.DB.calls.sql[0], /ON CONFLICT/);
});

test('one source secret cannot write another source', async () => {
  const env = makeEnv();
  const response = await handleIngest(post({ source: 'web_traffic_daily', rows: [row] }, 'search-secret'), env);
  assert.equal(response.status, 401);
  assert.equal(env.DB.calls.batches, 0);
});

test('rejects unknown sources, including prototype keys', async () => {
  const env = makeEnv();
  for (const source of ['nope', 'constructor', '__proto__']) {
    const response = await handleIngest(post({ source, rows: [row] }, 'traffic-secret'), env);
    assert.equal(response.status, 400);
  }
});

test('rejects non-POST requests and invalid JSON', async () => {
  const env = makeEnv();
  const get = await handleIngest(new Request('https://ingest.example/'), env);
  assert.equal(get.status, 405);
  const bad = await handleIngest(post('{not json', 'traffic-secret'), env);
  assert.equal(bad.status, 400);
});

test('invalid rows are rejected before touching the database', async () => {
  const env = makeEnv();
  const response = await handleIngest(
    post({ source: 'web_traffic_daily', rows: [{ ...row, sessions: 'x' }] }, 'traffic-secret'),
    env
  );
  assert.equal(response.status, 400);
  assert.equal(env.DB.calls.batches, 0);
});
