// GA4 returns its date dimension as "20260825"; every table here stores ISO
// dates ("2026-08-25") so sources can be joined and sorted as plain text.
export function normalizeCompactDate(value) {
  const text = String(value);
  if (!/^\d{8}$/.test(text)) return text;
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

// The day we treat as final: `lagDays` before `now`, as YYYY-MM-DD in UTC.
// Analytics tools keep revising the most recent days, so the collector only
// ever pulls a day once it is old enough to have settled.
export function settledDay(now, lagDays) {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - lagDays)
  );
  return day.toISOString().slice(0, 10);
}

export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
