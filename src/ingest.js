import { isIsoDate } from './dates.js';
import { normalizePagePath } from './paths.js';

// Kept small on purpose: the Workers Free plan allows 10 ms of CPU per
// request, and validating a huge batch in one request is the easiest way to
// exceed it. The collectors send batches of this size or smaller.
export const MAX_ROWS_PER_REQUEST = 1000;

// Validates and normalises a batch. Returns new objects; the input is never
// modified.
//
// Key columns arrive as '' (never null/undefined) when "not set". SQLite
// treats every NULL as different from every other NULL, so a UNIQUE
// constraint over nullable columns silently stops de-duplicating: the same
// day pulled twice would insert twice. Storing '' keeps one row per real
// combination.
export function validateRows(source, rows, { maxRows = MAX_ROWS_PER_REQUEST } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: 'rows must be a non-empty array' };
  }
  if (rows.length > maxRows) {
    return { ok: false, error: `too many rows (max ${maxRows})` };
  }

  const normalised = [];
  for (const [index, row] of rows.entries()) {
    const result = normaliseRow(source, row);
    if (!result.ok) return { ok: false, error: `row ${index}: ${result.error}` };
    normalised.push(result.row);
  }
  return { ok: true, rows: normalised };
}

function normaliseRow(source, row) {
  if (row === null || typeof row !== 'object') {
    return { ok: false, error: 'must be an object' };
  }
  if (!isIsoDate(row.date)) {
    return { ok: false, error: 'date must be YYYY-MM-DD' };
  }

  const keys = Object.fromEntries(
    source.keyColumns.map((column) => {
      const text = String(row[column] ?? '');
      return [column, source.pathColumns.includes(column) ? normalizePagePath(text) : text];
    })
  );

  const metrics = {};
  for (const column of source.metricColumns) {
    const value = Number(row[column]);
    if (!Number.isFinite(value)) {
      return { ok: false, error: `${column} must be a finite number` };
    }
    metrics[column] = value;
  }

  return { ok: true, row: { date: row.date, ...keys, ...metrics } };
}

export function columnsFor(source) {
  return ['date', ...source.keyColumns, ...source.metricColumns];
}

// INSERT ... ON CONFLICT DO UPDATE: re-sending a day overwrites the metrics
// instead of duplicating the row, so a manual re-run is always safe.
export function buildUpsertSql(source) {
  const columns = columnsFor(source);
  const conflictTarget = ['date', ...source.keyColumns].join(', ');
  const updates = source.metricColumns
    .map((column) => `${column}=excluded.${column}`)
    .join(', ');
  const placeholders = columns.map(() => '?').join(', ');

  return (
    `INSERT INTO ${source.table} (${columns.join(', ')}) VALUES (${placeholders}) ` +
    `ON CONFLICT(${conflictTarget}) DO UPDATE SET ${updates}`
  );
}

export function toBindings(source, row) {
  return columnsFor(source).map((column) => row[column]);
}
