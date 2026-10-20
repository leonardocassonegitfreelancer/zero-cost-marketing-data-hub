-- Pages that attract visitors but never produce a lead: the first place to
-- look for a weak call to action, a broken form or the wrong audience.
-- The 50-session floor keeps tiny pages from flooding the list; change it to
-- fit your volume.
SELECT page_path,
       SUM(sessions)         AS sessions,
       SUM(engaged_sessions) AS engaged_sessions,
       SUM(key_events)       AS key_events
FROM v_page_funnel_daily
WHERE date >= date((SELECT MAX(date) FROM v_page_funnel_daily), '-89 days')
GROUP BY page_path
HAVING SUM(sessions) >= 50 AND SUM(leads) = 0
ORDER BY sessions DESC
LIMIT 20;
