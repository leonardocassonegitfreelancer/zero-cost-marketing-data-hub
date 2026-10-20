import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateLeadOutcomes } from '../src/aggregate-leads.js';

const options = { timeZone: 'Europe/Madrid' };

const events = [
  { created_at: '2026-09-01T10:00:00Z', page_url: 'https://example.com/es/pricing/?utm=1', status: 'Won', value_eur: 500 },
  { created_at: '2026-09-01T11:00:00Z', page_url: 'https://example.com/es/pricing#form', status: 'won', value_eur: 250 },
  { created_at: '2026-09-01T12:00:00Z', page_url: 'https://example.com/es/pricing', status: 'open', value_eur: '' },
];

test('counts and sums per local day, page and status', () => {
  const { rows } = aggregateLeadOutcomes(events, options);
  const won = rows.find((row) => row.status === 'won');
  const open = rows.find((row) => row.status === 'open');
  assert.deepEqual(won, {
    date: '2026-09-01', page_path: '/es/pricing', status: 'won', leads: 2, value_eur: 750,
  });
  assert.deepEqual(open, {
    date: '2026-09-01', page_path: '/es/pricing', status: 'open', leads: 1, value_eur: 0,
  });
});

test('a late-evening UTC lead lands on the next local day', () => {
  const { rows } = aggregateLeadOutcomes(
    [{ created_at: '2026-09-01T23:30:00Z', page_url: '/', status: 'open', value_eur: 0 }],
    options
  );
  assert.equal(rows[0].date, '2026-09-02');
});

test('events with an unreadable timestamp are skipped and counted', () => {
  const { rows, skipped } = aggregateLeadOutcomes(
    [{ created_at: 'garbage', page_url: '/', status: 'open', value_eur: 0 }, ...events],
    options
  );
  assert.equal(skipped, 1);
  assert.equal(rows.reduce((sum, row) => sum + row.leads, 0), 3);
});

test('output rows carry no personal fields, whatever the input had', () => {
  const { rows } = aggregateLeadOutcomes(
    [{ ...events[0], name: 'Ana', email: 'ana@example.com', phone: '+34600000000' }],
    options
  );
  assert.deepEqual(Object.keys(rows[0]).sort(), ['date', 'leads', 'page_path', 'status', 'value_eur']);
});

test('the input events are not modified', () => {
  const copy = JSON.parse(JSON.stringify(events));
  aggregateLeadOutcomes(events, options);
  assert.deepEqual(events, copy);
});
