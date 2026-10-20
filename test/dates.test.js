import test from 'node:test';
import assert from 'node:assert/strict';
import { isIsoDate, normalizeCompactDate, settledDay, toLocalDate } from '../src/dates.js';

test('normalizeCompactDate turns 20260825 into an ISO date', () => {
  assert.equal(normalizeCompactDate('20260825'), '2026-08-25');
});

test('normalizeCompactDate leaves other values untouched', () => {
  assert.equal(normalizeCompactDate('2026-08-25'), '2026-08-25');
  assert.equal(normalizeCompactDate('(not set)'), '(not set)');
});

test('settledDay goes back the requested number of days', () => {
  assert.equal(settledDay(new Date('2026-09-10T08:00:00Z'), 3), '2026-09-07');
});

test('settledDay crosses month and year boundaries', () => {
  assert.equal(settledDay(new Date('2027-01-02T00:30:00Z'), 3), '2026-12-30');
});

test('isIsoDate rejects impossible and malformed dates', () => {
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('26-02-03'), false);
  assert.equal(isIsoDate(20260203), false);
  assert.equal(isIsoDate('2026-02-03'), true);
});

test('toLocalDate files a late-evening UTC instant under the local next day', () => {
  assert.equal(toLocalDate('2026-09-01T23:30:00Z', 'Europe/Madrid'), '2026-09-02');
  assert.equal(toLocalDate('2026-09-01T23:30:00Z', 'Etc/UTC'), '2026-09-01');
});

test('toLocalDate returns null for an unreadable timestamp', () => {
  assert.equal(toLocalDate('not a date', 'Europe/Madrid'), null);
  assert.equal(toLocalDate(undefined, 'Europe/Madrid'), null);
});
