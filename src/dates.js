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

// Calendar date of an instant in a given time zone, as YYYY-MM-DD.
//
// Why this exists: a lead stamped 2026-09-01T23:30:00Z is already
// 2026-09-02 in Madrid. Taking the first ten characters of a UTC timestamp
// files late-evening leads under the wrong day, which then never lines up
// with the analytics days they should be compared against.
export function toLocalDate(isoTimestamp, timeZone) {
  const instant = new Date(isoTimestamp);
  if (Number.isNaN(instant.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
