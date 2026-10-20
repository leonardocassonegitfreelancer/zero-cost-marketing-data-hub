# Costs and limits

**Checked against the official documentation on 2026-10-20.** Free tiers change; before relying on any figure, open the linked page. Figures below are quoted from those pages, not from memory.

## What the free plans allow

| Piece | Free allowance (as documented) | Source |
|---|---|---|
| **D1** rows read | 5 million per day | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| **D1** rows written | 100,000 per day | same |
| **D1** storage | 5 GB in total | same |
| **Workers** requests | 100,000 per day | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Workers** CPU time | 10 ms per HTTP request | same |
| **Workers** subrequests | 50 per request | same |
| **Apps Script** URL fetch calls (gmail.com account) | 20,000 per day | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| **Apps Script** triggers total runtime (gmail.com account) | 90 minutes per day | same |
| **Apps Script** run time per execution | 6 minutes | same |
| **GA4 Data API** (standard property) | 200,000 tokens per property per day, 40,000 per hour, 10 concurrent requests | [GA4 Data API quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas) |

What D1 does when you hit a limit, in its own words: once the daily read or write limit is reached, "you will not be able to run queries against D1" until it resets. Reaching the storage limit means deleting data before you can insert more.

Not checked here: Search Console API quotas. Look them up before planning heavy backfills.

## What this design does with those limits

- **10 ms of CPU per request** is the tightest limit for this Worker. Requests are capped at 1,000 rows, and the collectors send batches of 500. This repository has not measured the CPU time of a 1,000-row request on the real platform; if requests start failing for exceeding the CPU limit, lower the batch size first.
- **Writes** are the likeliest limit to matter. Every upserted row counts toward the 100,000 per day (how D1 meters index maintenance on top of that is not covered by the page I checked). The daily collectors write one settled day, which for a small site should be well under that, but the row count depends on how many pages, channels and devices you break traffic into: measure your own first run. A large initial backfill is where you would hit it: spread it over several days.
- **Reads** are consumed by queries, including the views. A view over millions of rows scanned several times a day can use the 5 million read allowance quickly, which is a reason to keep tables to the grain you need and to avoid extra indexes you do not query.
- **Apps Script's 6-minute limit** per run is why the collectors pull one day (or a 90-day window of lead counts) and not whole histories.
- **Settled days** also keep GA4 token usage tiny: one day, a handful of dimensions, once a day.

## What is not free

- **Your time.** Setup, schema changes and keeping an eye on the collectors.
- **The first limit you hit is more likely D1 writes or Apps Script daily runtime than storage** (a judgement, not a measurement: it depends on your volume).
- **Where this stops being the right tool:** many sites or clients on one account, sub-daily freshness, or joins across millions of rows. At that point a paid Workers/D1 plan is usually the first, cheap step before a warehouse. Each paid plan has its own price list; check it on the vendor's page rather than trusting any number copied into a README.

## Reading the numbers honestly

"Zero cost" here means **zero licence cost within these free allowances**, on the date above. It is not a promise about future pricing, and it assumes you stay inside the limits.
