// Apps Script collector for lead OUTCOMES: reads a Google Sheet tab of leads
// and posts daily counts per page and status to the ingest Worker. Only
// counts and value leave the sheet; no name, e-mail or phone is read into the
// payload.
//
// This mirrors src/aggregate-leads.js, which is the tested reference
// (Apps Script cannot import modules). NOT executed against a live account
// as part of this repository's tests.
//
// Unlike analytics days, lead statuses keep changing (open -> won/lost), so
// this re-sends a rolling window on every run instead of one settled day. The
// Worker upserts, so re-sending is safe and old counts are overwritten.
//
// Expected sheet tab "Leads" with a header row containing at least:
//   created_at   (a date/time cell)
//   page_url     (the page the form was submitted from)
//   status       (e.g. open, won, lost)
//   value_eur    (number, may be empty)
//
// Setup: Script Properties > INGEST_SECRET_LEADS = the Worker secret.
// Trigger: collectLeadOutcomes > Time-driven > Day timer.

var LEADS_SHEET_NAME = 'Leads';
var LEADS_WORKER_URL = 'https://your-worker.example.workers.dev/';
var LEADS_TIME_ZONE = 'Europe/Madrid'; // the business's local day, not UTC
var ROLLING_WINDOW_DAYS = 90;
var BATCH_SIZE = 500; // keep requests small: Workers Free allows 10 ms CPU each

function collectLeadOutcomes() {
  var events = readLeadEvents_();
  var outcomes = aggregate_(events);
  if (outcomes.length === 0) {
    Logger.log('No lead outcomes in the window; nothing sent.');
    return;
  }
  postInBatches_(outcomes);
  Logger.log('Sent ' + outcomes.length + ' lead outcome rows.');
}

function readLeadEvents_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LEADS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var index = {
    createdAt: headers.indexOf('created_at'),
    pageUrl: headers.indexOf('page_url'),
    status: headers.indexOf('status'),
    value: headers.indexOf('value_eur')
  };
  if (index.createdAt < 0 || index.pageUrl < 0 || index.status < 0) {
    throw new Error('Leads tab needs the columns created_at, page_url and status');
  }

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ROLLING_WINDOW_DAYS);

  var events = [];
  for (var r = 1; r < values.length; r++) {
    var created = values[r][index.createdAt];
    if (!(created instanceof Date) || created < cutoff) continue;
    events.push({
      createdAt: created,
      pageUrl: String(values[r][index.pageUrl] || ''),
      status: String(values[r][index.status] || '').trim().toLowerCase(),
      value: index.value >= 0 ? Number(values[r][index.value]) || 0 : 0
    });
  }
  return events;
}

function aggregate_(events) {
  var buckets = {};
  events.forEach(function (event) {
    // Local calendar day, not the first ten characters of a UTC timestamp.
    var date = Utilities.formatDate(event.createdAt, LEADS_TIME_ZONE, 'yyyy-MM-dd');
    var key = [date, event.pageUrl, event.status].join('\u0000');
    if (!buckets[key]) {
      // page_path is sent as the raw URL; the Worker normalises it.
      buckets[key] = { date: date, page_path: event.pageUrl, status: event.status, leads: 0, value_eur: 0 };
    }
    buckets[key].leads += 1;
    buckets[key].value_eur += event.value;
  });
  return Object.keys(buckets).map(function (key) { return buckets[key]; });
}

function postInBatches_(rows) {
  var secret = PropertiesService.getScriptProperties().getProperty('INGEST_SECRET_LEADS');
  if (!secret) throw new Error('Missing script property INGEST_SECRET_LEADS');
  for (var start = 0; start < rows.length; start += BATCH_SIZE) {
    var response = UrlFetchApp.fetch(LEADS_WORKER_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + secret },
      payload: JSON.stringify({ source: 'lead_outcomes_daily', rows: rows.slice(start, start + BATCH_SIZE) }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Worker rejected a batch: ' + response.getResponseCode() + ' ' + response.getContentText());
    }
  }
}
