import { toLocalDate } from './dates.js';
import { normalizePagePath } from './paths.js';

// Turns individual lead events into the daily outcome rows the hub stores.
// This is the privacy boundary: a person's name, e-mail or phone never gets
// this far, only counts and value per (local day, page, status).
//
// event: { created_at: ISO timestamp, page_url, status, value_eur }
//
// The Apps Script collector (apps-script/collectLeadOutcomes.gs) mirrors this
// logic because Apps Script cannot import modules; this version is the
// tested reference.
export function aggregateLeadOutcomes(events, { timeZone }) {
  const buckets = new Map();
  let skipped = 0;

  for (const event of events) {
    const date = toLocalDate(event?.created_at, timeZone);
    if (date === null) {
      skipped += 1;
      continue;
    }

    const pagePath = normalizePagePath(event.page_url);
    const status = String(event.status ?? '').trim().toLowerCase();
    const value = Number(event.value_eur);
    const key = `${date}\u0000${pagePath}\u0000${status}`;

    const current = buckets.get(key) ?? {
      date, page_path: pagePath, status, leads: 0, value_eur: 0,
    };
    buckets.set(key, {
      ...current,
      leads: current.leads + 1,
      value_eur: current.value_eur + (Number.isFinite(value) ? value : 0),
    });
  }

  return { rows: [...buckets.values()], skipped };
}
