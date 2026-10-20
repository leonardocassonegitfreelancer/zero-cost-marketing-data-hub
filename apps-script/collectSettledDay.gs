// Apps Script collector: pulls ONE settled day from the GA4 Data API and
// posts it to the ingest Worker in this repo.
//
// NOT executed against a live account as part of this repository's tests
// (Apps Script cannot run in CI). The Worker side is covered by `npm test`.
//
// Setup (manual, once):
//   1. Replace GA4_PROPERTY_ID with the numeric property id from
//      GA4 Admin > Property Settings (NOT the "G-XXXXXXX" measurement id).
//   2. Replace WORKER_URL with your deployed Worker URL.
//   3. Project Settings > "Show appsscript.json", add to oauthScopes:
//        https://www.googleapis.com/auth/analytics.readonly
//        https://www.googleapis.com/auth/script.external_request
//   4. Script Properties > INGEST_SECRET_WEB_TRAFFIC = the Worker secret
//      (never put the secret in this file).
//   5. Triggers > collectSettledDay > Time-driven > Day timer.

var GA4_PROPERTY_ID = 'YOUR_GA4_PROPERTY_ID';
var WORKER_URL = 'https://your-worker.example.workers.dev/';
var SETTLE_LAG_DAYS = 3; // days to wait before a day is treated as final
var TIME_ZONE = 'Etc/UTC';

// API dimension/metric names (camelCase) mapped to the snake_case columns
// the Worker expects. One place to change when adding a breakdown.
var DIMENSIONS = [
  { api: 'landingPage', column: 'landing_page' },
  { api: 'sessionDefaultChannelGroup', column: 'channel' },
  { api: 'deviceCategory', column: 'device' }
];
var METRICS = [
  { api: 'sessions', column: 'sessions' },
  { api: 'engagedSessions', column: 'engaged_sessions' },
  { api: 'keyEvents', column: 'key_events' }
];

function collectSettledDay() {
  var day = settledDay_(new Date(), SETTLE_LAG_DAYS);
  var rows = fetchDay_(day);
  if (rows.length === 0) {
    Logger.log('No rows for ' + day + '; nothing sent.');
    return;
  }
  postToWorker_(rows);
  Logger.log('Sent ' + rows.length + ' rows for ' + day);
}

function settledDay_(now, lagDays) {
  var target = new Date(now.getTime());
  target.setDate(target.getDate() - lagDays);
  return Utilities.formatDate(target, TIME_ZONE, 'yyyy-MM-dd');
}

function fetchDay_(day) {
  var payload = {
    dateRanges: [{ startDate: day, endDate: day }],
    dimensions: [{ name: 'date' }].concat(DIMENSIONS.map(function (d) { return { name: d.api }; })),
    metrics: METRICS.map(function (m) { return { name: m.api }; }),
    limit: 100000
  };
  var response = UrlFetchApp.fetch(
    'https://analyticsdata.googleapis.com/v1beta/properties/' + GA4_PROPERTY_ID + ':runReport',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() !== 200) {
    // Throw so the failure shows up in the trigger's failure e-mail instead
    // of looking like an empty day.
    throw new Error('GA4 API error ' + response.getResponseCode() + ': ' + response.getContentText());
  }
  var json = JSON.parse(response.getContentText());
  return (json.rows || []).map(function (row) { return toRecord_(row, json); });
}

function toRecord_(row, json) {
  var record = {};
  (json.dimensionHeaders || []).forEach(function (header, i) {
    var value = row.dimensionValues[i].value;
    if (header.name === 'date') {
      record.date = normalizeCompactDate_(value);
      return;
    }
    var match = DIMENSIONS.filter(function (d) { return d.api === header.name; })[0];
    record[match ? match.column : header.name] = value;
  });
  (json.metricHeaders || []).forEach(function (header, i) {
    var match = METRICS.filter(function (m) { return m.api === header.name; })[0];
    record[match ? match.column : header.name] = Number(row.metricValues[i].value);
  });
  return record;
}

// GA4 returns "20260825"; the Worker expects "2026-08-25".
function normalizeCompactDate_(value) {
  return /^\d{8}$/.test(value)
    ? value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8)
    : value;
}

function postToWorker_(rows) {
  var secret = PropertiesService.getScriptProperties().getProperty('INGEST_SECRET_WEB_TRAFFIC');
  if (!secret) throw new Error('Missing script property INGEST_SECRET_WEB_TRAFFIC');
  var response = UrlFetchApp.fetch(WORKER_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify({ source: 'web_traffic_daily', rows: rows }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Worker rejected the batch: ' + response.getResponseCode() + ' ' + response.getContentText());
  }
}
