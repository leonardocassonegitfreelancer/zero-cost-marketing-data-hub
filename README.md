# Settled-day analytics pipeline

A small, dependency-free pipeline for marketing data that has to be **trustworthy before it is pretty**: an Apps Script collector pulls one *settled* day from an analytics API, a Cloudflare Worker validates it, and Cloudflare D1 stores it so that re-running a day never duplicates a row.

```
Apps Script (daily trigger)  ->  Worker (auth + validation)  ->  D1 (idempotent upsert)
   pulls day N-3 from GA4        per-source secrets               one row per real combination
```

The code is generic on purpose: sources are declared in [`src/sources.js`](src/sources.js), and adding a third one is a few lines plus a table in [`schema.sql`](schema.sql).

## Why it is built this way

Most "data-driven" failures I have seen are not dashboard problems, they are quiet data problems. Each decision below exists to prevent one.

| Decision | Problem it prevents |
|---|---|
| **Pull only a settled day** (`SETTLE_LAG_DAYS = 3`) and never revisit it | Analytics tools keep revising the latest days. Comparing a half-final yesterday with a final last week reads as a false drop. A fixed lag makes the delay a known property of the data, not a mystery gap. |
| **Idempotent upsert** on `(date, ...dimensions)` | A manual re-run, a retry or a trigger firing twice must not double-count sessions. |
| **Key dimensions stored as `''`, never `NULL`** | In SQLite every `NULL` is distinct from every other `NULL`, so a `UNIQUE` constraint over nullable columns silently stops de-duplicating. |
| **Table and column names only from a registry** | The SQL is built from `src/sources.js`, never from request fields, so a caller cannot shape the query. |
| **One write secret per source** | Revoking or rotating one collector never touches another. |
| **Secrets trimmed; an empty secret never authorises** | A secret pasted with a trailing space is a classic silent failure. A Worker that lost its secret binding must reject requests, not accept ones that send no credentials. |
| **Collector throws on API errors** | A failed pull should appear in the trigger's failure e-mail, not look like an empty day. |
| **ISO dates everywhere** | GA4 returns `20260825`; normalising once keeps every source joinable and sortable as text. |

## Layout

```
apps-script/collectSettledDay.gs   collector (placeholders only, no real ids)
src/worker.js                      request handler: method, JSON, source, auth, validation, upsert
src/sources.js                     source registry (table, keys, metrics, secret name)
src/ingest.js                      validation + SQL builder (pure functions)
src/auth.js                        constant-time bearer check
src/dates.js                       settled-day and date normalisation
schema.sql                         D1 tables and indexes
test/                              node:test suite
```

## Run the tests

Needs Node 20 or newer, no install step.

```
npm test
```

The suite covers date handling, the auth rules, validation, the generated SQL and the Worker handler against a fake D1 binding. Two more tests run the real schema and the generated upsert against SQLite itself (the engine under D1) to prove that a re-sent day updates one row and that `NULL` dimensions would duplicate; they need the built-in `node:sqlite` module (Node 22.5+) and are skipped on older versions.

## Deploy (sketch)

1. `wrangler d1 create analytics`, then `wrangler d1 execute analytics --file=schema.sql`.
2. Copy `wrangler.toml.example` to `wrangler.toml` and fill in your own database id.
3. `wrangler secret put INGEST_SECRET_WEB_TRAFFIC` (and one per extra source).
4. `wrangler deploy`, then set up the Apps Script project as described at the top of the collector.

## Honest limits

- The Apps Script collector is **not exercised by the test suite**; Apps Script cannot run in CI. The Worker, validation and SQL are tested.
- No retry or queue layer: a failed run raises an error and you re-run that day, which is safe because of the upsert.
- The Worker trusts its callers to send already-aggregated rows. It validates shape and types, not business meaning.

## License

MIT
