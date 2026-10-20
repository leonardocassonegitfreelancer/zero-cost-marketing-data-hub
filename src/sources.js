// One entry per data source. Table and column names come ONLY from this
// registry, never from the request, so the SQL built from it cannot be
// influenced by whoever calls the endpoint.
//
// keyColumns   -> text dimensions that, with `date`, identify one row
// metricColumns -> numbers that may be revised and are overwritten on re-pull
// secretEnv    -> the Worker secret that authorises writes to THIS source only
export const SOURCES = Object.freeze({
  web_traffic_daily: Object.freeze({
    table: 'web_traffic_daily',
    secretEnv: 'INGEST_SECRET_WEB_TRAFFIC',
    keyColumns: Object.freeze(['landing_page', 'channel', 'device']),
    metricColumns: Object.freeze(['sessions', 'engaged_sessions', 'key_events']),
  }),
  search_queries_daily: Object.freeze({
    table: 'search_queries_daily',
    secretEnv: 'INGEST_SECRET_SEARCH',
    keyColumns: Object.freeze(['query', 'page', 'country']),
    metricColumns: Object.freeze(['clicks', 'impressions']),
  }),
});
