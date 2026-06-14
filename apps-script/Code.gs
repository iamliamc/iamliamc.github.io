/**
 * Wedding RSVP → Google Sheet
 * ---------------------------------------------------------------
 * Backend for the RSVP form in index.html. Appends one row per RSVP
 * to the active spreadsheet. See SETUP.md for deploy steps.
 *
 * The page submits via JSONP (a <script> tag with a ?callback= param)
 * because a published Apps Script web app can't send CORS headers —
 * JSONP lets the browser READ the reply, so the page only shows
 * "Thank you!" when this returns result:"success". No silent data loss.
 */

// Column order written to the sheet. The header row is created
// automatically on first run if the sheet is empty.
var FIELDS = ['timestamp', 'name', 'attending', 'party_size', 'meal', 'dietary', 'message'];

// JSONP submission (from the form) and health checks both arrive as GET.
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  // A callback param means this is a real form submission via JSONP.
  if (params.callback) {
    return jsonp(params.callback, handle(params));
  }
  // Otherwise it's just a "is this live?" check (e.g. curl, browser).
  return json({ result: 'ok', message: 'RSVP endpoint is live. Submit via the form.' });
}

// Kept so a plain POST (e.g. curl multipart) still works for testing.
function doPost(e) {
  return json(handle((e && e.parameter) ? e.parameter : {}));
}

// Shared logic: validate honeypot, then append a row.
function handle(params) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000); // serialize concurrent submissions

    // Honeypot: bots fill the hidden "website" field. Drop silently.
    if (params.website) {
      return { result: 'success' }; // pretend success so bots don't retry
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(FIELDS);
    }

    var row = FIELDS.map(function (key) {
      if (key === 'timestamp') return new Date();
      return params[key] || '';
    });
    sheet.appendRow(row);

    lock.releaseLock();
    return { result: 'success' };
  } catch (err) {
    return { result: 'error', message: String(err) };
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp(callback, obj) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
