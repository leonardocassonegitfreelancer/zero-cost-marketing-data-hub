import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../src/sources.js';
import { buildUpsertSql, toBindings, validateRows } from '../src/ingest.js';

const traffic = SOURCES.web_traffic_daily;

const goodRow = {
  date: '2026-09-07',
  landing_page: '/pricing',
  channel: 'Organic Search',
  device: 'mobile',
  sessions: 12,
  engaged_sessions: 9,
  key_events: 2,
};

test('validateRows accepts a well-formed batch and returns new objects', () => {
  const result = validateRows(traffic, [goodRow]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows[0], goodRow);
  assert.notEqual(result.rows[0], goodRow);
});

test('missing key dimensions become empty strings, never null', () => {
  const { landing_page, channel, device, ...rest } = goodRow;
  const result = validateRows(traffic, [rest]);
  assert.equal(result.ok, true);
  assert.deepEqual(
    [result.rows[0].landing_page, result.rows[0].channel, result.rows[0].device],
    ['', '', '']
  );
});

test('rejects an empty or non-array batch', () => {
  assert.equal(validateRows(traffic, []).ok, false);
  assert.equal(validateRows(traffic, 'nope').ok, false);
});

test('rejects a batch over the row limit', () => {
  const result = validateRows(traffic, [goodRow, goodRow, goodRow], { maxRows: 2 });
  assert.equal(result.ok, false);
});

test('rejects a bad date and names the offending row', () => {
  const result = validateRows(traffic, [goodRow, { ...goodRow, date: '07/09/2026' }]);
  assert.equal(result.ok, false);
  assert.match(result.error, /row 1/);
});

test('rejects a non-numeric metric', () => {
  const result = validateRows(traffic, [{ ...goodRow, sessions: 'lots' }]);
  assert.equal(result.ok, false);
  assert.match(result.error, /sessions/);
});

test('buildUpsertSql targets the composite key and updates only metrics', () => {
  const sql = buildUpsertSql(traffic);
  assert.match(sql, /^INSERT INTO web_traffic_daily \(date, landing_page, channel, device, sessions, engaged_sessions, key_events\)/);
  assert.match(sql, /ON CONFLICT\(date, landing_page, channel, device\) DO UPDATE SET/);
  assert.match(sql, /sessions=excluded\.sessions/);
  assert.doesNotMatch(sql, /landing_page=excluded/);
});

test('toBindings follows the column order of the SQL', () => {
  assert.deepEqual(toBindings(traffic, goodRow), [
    '2026-09-07', '/pricing', 'Organic Search', 'mobile', 12, 9, 2,
  ]);
});
