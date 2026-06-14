/**
 * Wedding RSVP → Google Sheet (with guest-list + party-cap enforcement)
 * ---------------------------------------------------------------
 * Two tabs in the spreadsheet:
 *   • "Guests"  — your invite list.  Columns: Name | MaxPlusOnes
 *                  (0 = no +1, 1 = may bring one, etc.)  Header row in row 1.
 *   • "RSVPs"   — responses land here (created automatically on first reply).
 *
 * The page talks to this script three ways, all as JSONP GETs (a <script>
 * tag, because a published Apps Script web app can't send CORS headers):
 *   • ?mode=names   → ["Name", ...]      fills the dropdown (no allowances sent)
 *   • ?mode=lookup&name=… → {found, maxPlusOnes}   drives the +1 field
 *   • (a submission) → validates name + party size, then appends a row
 *
 * The submit path re-checks everything server-side, so the seat cap holds
 * even if someone edits the page in their browser. See SETUP.md.
 */

var GUESTS_TAB = 'Guests';
var RSVP_TAB = 'RSVPs';

// Column order written to the RSVPs tab. Header created on first run.
// meal = the primary guest's choice; additional_guests = "Name (Meal); ...";
// vegan_count / omnivore_count = totals for the whole party (incl. primary).
var FIELDS = ['timestamp', 'name', 'attending', 'party_size', 'meal',
              'additional_guests', 'vegan_count', 'omnivore_count', 'dietary', 'message'];

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.callback) {
    if (params.mode === 'names') return jsonp(params.callback, { result: 'ok', names: guestNames() });
    if (params.mode === 'lookup') return jsonp(params.callback, lookupGuest(params.name));
    return jsonp(params.callback, handle(params)); // a submission
  }
  return json({ result: 'ok', message: 'RSVP endpoint is live. Submit via the form.' });
}

// Kept so a plain POST (e.g. curl) still works for testing.
function doPost(e) {
  return json(handle((e && e.parameter) ? e.parameter : {}));
}

// ── Guest list helpers ────────────────────────────────────────────────
function guestSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTS_TAB);
}

// Map of lowercased name → maxPlusOnes (the source of truth for the cap).
function guestMap() {
  var sh = guestSheet();
  var map = {};
  if (!sh) return map;
  var last = sh.getLastRow();
  if (last < 2) return map;
  var vals = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    var name = String(vals[i][0]).trim();
    if (!name) continue;
    var max = parseInt(vals[i][1], 10);
    if (isNaN(max) || max < 0) max = 0;
    map[name.toLowerCase()] = max;
  }
  return map;
}

function guestNames() {
  var sh = guestSheet();
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  var names = [];
  for (var i = 0; i < vals.length; i++) {
    var n = String(vals[i][0]).trim();
    if (n) names.push(n);
  }
  return names;
}

function lookupGuest(name) {
  var key = String(name || '').trim().toLowerCase();
  var map = guestMap();
  if (map.hasOwnProperty(key)) return { result: 'ok', found: true, maxPlusOnes: map[key] };
  return { result: 'ok', found: false };
}

// ── Submission ────────────────────────────────────────────────────────
function handle(params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // serialize concurrent submissions

    // Honeypot: bots fill the hidden "website" field. Pretend success, write nothing.
    if (params.website) return { result: 'success' };

    var key = String(params.name || '').trim().toLowerCase();
    var map = guestMap();

    // Only invited names may RSVP.
    if (!map.hasOwnProperty(key)) {
      return { result: 'not_invited' };
    }

    var maxTotal = 1 + map[key];
    var declined = String(params.attending || '').toLowerCase().indexOf('regret') === 0;

    var party = parseInt(params.party_size, 10);
    if (isNaN(party) || party < 1) party = 1;
    if (declined) party = 1;            // a decline is just them
    if (party > maxTotal) {
      return { result: 'over_limit', allowed: maxTotal };  // refuse over-cap
    }

    var sheet = rsvpSheet();
    ensureHeader(sheet);

    var clean = {
      timestamp: new Date(),
      name: String(params.name || '').trim(),
      attending: params.attending || '',
      party_size: party,
      meal: declined ? '' : (params.meal || ''),
      additional_guests: declined ? '' : (params.additional_guests || ''),
      vegan_count: declined ? '' : (params.vegan_count || ''),
      omnivore_count: declined ? '' : (params.omnivore_count || ''),
      dietary: params.dietary || '',
      message: params.message || ''
    };
    sheet.appendRow(FIELDS.map(function (f) { return clean[f]; }));

    return { result: 'success' };
  } catch (err) {
    return { result: 'error', message: String(err) };
  } finally {
    lock.releaseLock();
  }
}

// Responses go to their own tab so they never collide with the Guests list.
function rsvpSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(RSVP_TAB) || ss.insertSheet(RSVP_TAB);
}

// Make sure row 1 always matches FIELDS. Runs on every write, so if FIELDS
// ever changes the header self-corrects on the next RSVP. Only rewrites when
// the labels actually differ, so it doesn't touch the sheet needlessly.
// (This corrects the header labels only; it does not move existing data cells.)
function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(FIELDS);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, FIELDS.length).getValues()[0];
  var matches = FIELDS.every(function (label, i) {
    return String(existing[i]).trim() === label;
  });
  if (!matches) {
    sheet.getRange(1, 1, 1, FIELDS.length).setValues([FIELDS]);
  }
}

// Run this manually from the Apps Script editor to fix the header on demand
// (e.g. right after changing FIELDS) without waiting for the next RSVP.
function fixHeader() {
  ensureHeader(rsvpSheet());
}

// ── Output helpers ────────────────────────────────────────────────────
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
