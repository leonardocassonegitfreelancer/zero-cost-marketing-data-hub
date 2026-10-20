-- Which pages bring in revenue, not just visits?
-- Last 90 days of the data (relative to the newest day loaded, so the query
-- still works when the collectors are a few days behind).
--
-- Caveat: a lead is credited to the page it was submitted from, which is the
-- last step of the journey, not necessarily what persuaded the person. Read
-- this as "where deals close", not "what caused them".
SELECT page_path,
       SUM(sessions)       AS sessions,
       SUM(leads)          AS leads,
       SUM(won_leads)      AS won_leads,
       SUM(won_value_eur)  AS won_value_eur
FROM v_page_funnel_daily
WHERE date >= date((SELECT MAX(date) FROM v_page_funnel_daily), '-89 days')
GROUP BY page_path
HAVING SUM(won_leads) > 0
ORDER BY won_value_eur DESC
LIMIT 20;
