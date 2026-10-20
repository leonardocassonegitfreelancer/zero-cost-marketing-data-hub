-- Heuristic, not a rule: search clicks and sessions measure different things
-- (a click is not a session), so they will never match exactly. But for a
-- page that gets most of its visits from search, the two should be in the
-- same order of magnitude. A page with many clicks and almost no sessions is
-- worth a look: it can mean broken or missing analytics tracking on that
-- page.
SELECT page_path,
       SUM(clicks)   AS search_clicks,
       SUM(sessions) AS sessions,
       ROUND(SUM(sessions) * 1.0 / NULLIF(SUM(clicks), 0), 2) AS sessions_per_click
FROM v_page_funnel_daily
WHERE date >= date((SELECT MAX(date) FROM v_page_funnel_daily), '-29 days')
GROUP BY page_path
HAVING SUM(clicks) >= 30
ORDER BY sessions_per_click ASC
LIMIT 20;
