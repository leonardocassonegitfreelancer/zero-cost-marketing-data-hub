-- Cloudflare D1 (SQLite). Key dimensions are NOT NULL DEFAULT '' on purpose:
-- NULLs are all distinct in a UNIQUE constraint, which would defeat the
-- de-duplication the upsert relies on.
--
-- Every page column holds a canonical path (see src/paths.js), which is what
-- lets the three sources be joined. Apply this file first, then views.sql.

CREATE TABLE IF NOT EXISTS web_traffic_daily (
  date             TEXT NOT NULL,
  page_path        TEXT NOT NULL DEFAULT '',
  channel          TEXT NOT NULL DEFAULT '',
  device           TEXT NOT NULL DEFAULT '',
  sessions         REAL NOT NULL DEFAULT 0,
  engaged_sessions REAL NOT NULL DEFAULT 0,
  key_events       REAL NOT NULL DEFAULT 0,
  UNIQUE (date, page_path, channel, device)
);

CREATE TABLE IF NOT EXISTS search_queries_daily (
  date        TEXT NOT NULL,
  query       TEXT NOT NULL DEFAULT '',
  page_path   TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  clicks      REAL NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  UNIQUE (date, query, page_path, country)
);

-- Daily outcomes per page. No personal data by design: counts and value only.
CREATE TABLE IF NOT EXISTS lead_outcomes_daily (
  date      TEXT NOT NULL,
  page_path TEXT NOT NULL DEFAULT '',
  status    TEXT NOT NULL DEFAULT '',
  leads     REAL NOT NULL DEFAULT 0,
  value_eur REAL NOT NULL DEFAULT 0,
  UNIQUE (date, page_path, status)
);

-- The UNIQUE constraints above already create the indexes the upserts need.
-- No extra indexes: every index also has to be maintained on each write
-- (see docs/costs-and-limits.md).
