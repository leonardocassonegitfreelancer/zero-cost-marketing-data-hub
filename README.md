# Zero-cost marketing data hub

Put **GA4, Google Search Console and your lead outcomes in one database**, joined by page, using only free tiers: Apps Script collectors, a Cloudflare Worker and Cloudflare D1. Then ask the question most small teams cannot answer:

> Which pages bring visits, which of those visits turn into leads, and which leads turn into revenue?

```
Apps Script (daily)  ->  Worker (auth, validation)  ->  D1 (idempotent upserts)  ->  SQL views
GA4, Search Console,      per-source secrets,           one row per real              day + page, all
lead outcomes             canonical page paths          combination                   three sources
```

The interesting part is not the plumbing. It is the handful of quiet mistakes that make a joined marketing dashboard wrong while still looking right. Each one is reproduced in a test.

## What you can ask

Three ready-made queries in [`queries/`](queries):

| Query | Question |
|---|---|
| [`top-pages-by-won-value.sql`](queries/top-pages-by-won-value.sql) | Which pages bring revenue, not just visits? |
| [`traffic-without-leads.sql`](queries/traffic-without-leads.sql) | Which pages attract visitors but never produce a lead? |
| [`tracking-sanity-check.sql`](queries/tracking-sanity-check.sql) | Where might analytics tracking be broken? (heuristic) |

## The traps this repository handles

| Trap | What goes wrong | What the code does | Test |
|---|---|---|---|
| **The three sources name the page differently** | `/es/pricing/?utm=1`, `https://www.example.com/es/Pricing` and `…/es/pricing#form` never match, so the join returns nothing and nobody notices | One canonical path (no host, query, fragment or trailing slash, lower case, language prefix kept) applied on the way in: [`src/paths.js`](src/paths.js) | `paths.test.js` |
| **Joining raw tables multiplies rows** | A page with 2 search queries and 2 traffic rows appears 4 times and every `SUM` doubles. The numbers look plausible | Each source is aggregated to *day + page* before joining: [`views.sql`](views.sql) | `joins.test.js` reproduces the doubling |
| **A page in one source only gets dropped** | An inner join hides pages with traffic but no leads, exactly the ones you want to see | A "spine" of every day+page from any source, then left joins with zeros | `joins.test.js` |
| **UTC dates misfile late-evening leads** | A lead at 23:30 UTC is already tomorrow in Madrid, so it never lines up with that day's traffic | Leads are bucketed by the business's local calendar day: [`src/dates.js`](src/dates.js) | `dates.test.js`, `leads.test.js` |
| **`NULL` defeats `UNIQUE`** | In SQLite every `NULL` differs from every other `NULL`, so re-sending a day silently duplicates rows | Dimensions are stored as `''`, never `NULL` | `sqlite.test.js` against real SQLite |
| **Recent analytics days keep changing** | Comparing a half-final yesterday with a final last week reads as a false drop | Analytics are pulled one *settled* day at a time (3 days back), never revisited | — |
| **Lead statuses keep changing too** | A lead is open today and won next week | Lead outcomes are re-sent as a rolling window and upserted, so counts update | `joins.test.js` (idempotence) |
| **Personal data in an analytics database** | Names and e-mails do not belong next to traffic numbers | Leads are reduced to counts and value per day, page and status *before* leaving the sheet: [`src/aggregate-leads.js`](src/aggregate-leads.js) | `leads.test.js` checks no personal field survives |

## Cost

Zero licence cost **within the free allowances, checked on 2026-10-20**. The numbers, their sources and what this design does with them are in [`docs/costs-and-limits.md`](docs/costs-and-limits.md), including what is *not* free and where this stops being the right tool.

## Layout

```
apps-script/collectSettledDay.gs      GA4 collector, one settled day (placeholders only)
apps-script/collectLeadOutcomes.gs    lead outcomes from a Sheet tab, rolling window
src/worker.js                         handler: method, JSON, source, auth, validation, upsert
src/sources.js                        source registry (table, keys, metrics, secret name)
src/ingest.js                         validation + SQL builder (pure functions)
src/paths.js                          canonical page path
src/dates.js                          settled day, ISO and local dates
src/aggregate-leads.js                lead events -> daily outcomes (no personal data)
src/auth.js                           constant-time bearer check
schema.sql  views.sql  queries/       tables, joined views, sample questions
docs/costs-and-limits.md              limits and costs, with sources and date
test/                                 node:test suite
```

## Run the tests

Needs Node 20 or newer, no install step.

```
npm test
```

46 tests. The SQL and join tests run the real schema, the generated upserts and the views against SQLite itself (the engine under D1); they need the built-in `node:sqlite` module (Node 22.5+) and are skipped on older versions.

## Deploy (sketch)

1. `wrangler d1 create analytics`, then apply `schema.sql` and `views.sql` with `wrangler d1 execute analytics --file=...`.
2. Copy `wrangler.toml.example` to `wrangler.toml` and fill in your own database id.
3. `wrangler secret put` for each source secret listed in the example file.
4. `wrangler deploy`.
5. Create the Apps Script projects, fill in the placeholders at the top of each collector, store the secrets in Script Properties and add a daily trigger.

## Honest limits

- The Apps Script collectors are **not exercised by the test suite**; Apps Script cannot run in CI. The Worker, validation, SQL and joins are tested.
- The collectors cover GA4 and a leads sheet. A Search Console collector is not included: the `search_queries_daily` table and its ingest path are, so a collector only has to post rows in that shape.
- No retry or queue layer. A failed run raises an error and you re-run it, which is safe because of the upserts.
- Last-touch attribution: a lead is attributed to the page it was submitted from, not to whatever persuaded the person. Read the results as "where deals close".
- Page paths are lower-cased. That is almost always right for marketing sites and wrong if two paths differ only by case.
- Not measured here: the CPU time of a full 1,000-row request on the real Workers platform.

## License

MIT
