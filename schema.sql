-- Cloudflare D1 (SQLite). Key dimensions are NOT NULL DEFAULT '' on purpose:
-- NULLs are all distinct in a UNIQUE constraint, which would defeat the
-- de-duplication the upsert relies on.

CREATE TABLE IF NOT EXISTS web_traffic_daily (
  date             TEXT NOT NULL,
  landing_page     TEXT NOT NULL DEFAULT '',
  channel          TEXT NOT NULL DEFAULT '',
  device           TEXT NOT NULL DEFAULT '',
  sessions         REAL NOT NULL DEFAULT 0,
  engaged_sessions REAL NOT NULL DEFAULT 0,
  key_events       REAL NOT NULL DEFAULT 0,
  UNIQUE (date, landing_page, channel, device)
);

CREATE TABLE IF NOT EXISTS search_queries_daily (
  date        TEXT NOT NULL,
  query       TEXT NOT NULL DEFAULT '',
  page        TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  clicks      REAL NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  UNIQUE (date, query, page, country)
);

CREATE INDEX IF NOT EXISTS idx_web_traffic_date ON web_traffic_daily (date);
CREATE INDEX IF NOT EXISTS idx_search_queries_date ON search_queries_daily (date);
