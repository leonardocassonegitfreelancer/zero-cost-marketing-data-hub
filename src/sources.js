// One entry per data source. Table and column names come ONLY from this
// registry, never from the request, so the SQL built from it cannot be
// influenced by whoever calls the endpoint.
//
// keyColumns    text dimensions that, with `date`, identify one row
// metricColumns numbers that may be revised and are overwritten on re-pull
// pathColumns   key columns holding a page; reduced to a canonical path on
//               the way in so every source joins on the same value
// secretEnv     the Worker secret that authorises writes to THIS source only
export const SOURCES = Object.freeze({
  web_traffic_daily: Object.freeze({
    table: 'web_traffic_daily',
    secretEnv: 'INGEST_SECRET_WEB_TRAFFIC',
    keyColumns: Object.freeze(['page_path', 'channel', 'device']),
    metricColumns: Object.freeze(['sessions', 'engaged_sessions', 'key_events']),
    pathColumns: Object.freeze(['page_path']),
  }),
  search_queries_daily: Object.freeze({
    table: 'search_queries_daily',
    secretEnv: 'INGEST_SECRET_SEARCH',
    keyColumns: Object.freeze(['query', 'page_path', 'country']),
    metricColumns: Object.freeze(['clicks', 'impressions']),
    pathColumns: Object.freeze(['page_path']),
  }),
  // Leads are stored as daily OUTCOMES per page, never as individual people:
  // no name, e-mail or phone ever reaches this database. Unlike analytics
  // days, lead statuses keep changing (open -> won/lost), so the collector
  // re-sends a rolling window and the upsert overwrites the old counts.
  lead_outcomes_daily: Object.freeze({
    table: 'lead_outcomes_daily',
    secretEnv: 'INGEST_SECRET_LEADS',
    keyColumns: Object.freeze(['page_path', 'status']),
    metricColumns: Object.freeze(['leads', 'value_eur']),
    pathColumns: Object.freeze(['page_path']),
  }),
});
