-- Apply after schema.sql. Safe to re-run.
--
-- The one rule behind these views: AGGREGATE EACH SOURCE TO THE SAME GRAIN
-- (day + page) BEFORE JOINING.
--
-- The three source tables have different grains: search is one row per
-- query, traffic one row per channel and device, leads one row per status.
-- Joining the raw tables multiplies rows: a page with 2 search queries and
-- 2 traffic rows would appear 4 times, and every SUM silently doubles. That
-- error produces plausible-looking numbers, which is what makes it
-- dangerous. test/joins.test.js reproduces it and shows these views avoid it.
--
-- The "spine" is every (date, page) that appears in ANY source, so a page
-- with traffic but no leads (or leads but no search clicks) is kept with
-- zeros instead of being dropped by an inner join.

DROP VIEW IF EXISTS v_page_funnel_daily;

CREATE VIEW v_page_funnel_daily AS
WITH search AS (
  SELECT date, page_path,
         SUM(clicks)      AS clicks,
         SUM(impressions) AS impressions
  FROM search_queries_daily
  GROUP BY date, page_path
),
traffic AS (
  SELECT date, page_path,
         SUM(sessions)         AS sessions,
         SUM(engaged_sessions) AS engaged_sessions,
         SUM(key_events)       AS key_events
  FROM web_traffic_daily
  GROUP BY date, page_path
),
leads AS (
  SELECT date, page_path,
         SUM(leads) AS leads,
         SUM(CASE WHEN status = 'won' THEN leads     ELSE 0 END) AS won_leads,
         SUM(CASE WHEN status = 'won' THEN value_eur ELSE 0 END) AS won_value_eur
  FROM lead_outcomes_daily
  GROUP BY date, page_path
),
spine AS (
  SELECT date, page_path FROM search
  UNION
  SELECT date, page_path FROM traffic
  UNION
  SELECT date, page_path FROM leads
)
SELECT spine.date,
       spine.page_path,
       COALESCE(search.clicks, 0)           AS clicks,
       COALESCE(search.impressions, 0)      AS impressions,
       COALESCE(traffic.sessions, 0)        AS sessions,
       COALESCE(traffic.engaged_sessions, 0) AS engaged_sessions,
       COALESCE(traffic.key_events, 0)      AS key_events,
       COALESCE(leads.leads, 0)             AS leads,
       COALESCE(leads.won_leads, 0)         AS won_leads,
       COALESCE(leads.won_value_eur, 0)     AS won_value_eur
FROM spine
LEFT JOIN search  ON search.date  = spine.date AND search.page_path  = spine.page_path
LEFT JOIN traffic ON traffic.date = spine.date AND traffic.page_path = spine.page_path
LEFT JOIN leads   ON leads.date   = spine.date AND leads.page_path   = spine.page_path;
