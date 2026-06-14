# Wedding RSVP — Setup (≈10 minutes, one time)

The site (`patty-and-liams-wedding.html`) is a static page on GitHub Pages.
RSVPs are sent to a free **Google Apps Script** web app that appends each reply
to a **Google Sheet** you own. No servers, no cost.

The same Sheet also holds your **guest list**, which controls who may RSVP and
how many people each person can bring. The list lives in the Sheet (not in the
web page), so guests never see everyone's +1 allowances, and the seat cap is
enforced server-side — it holds even if someone tinkers with the page.

## 1. Create the Sheet + guest list
1. Go to <https://sheets.google.com> and create a new blank spreadsheet.
   Name it something like `Wedding RSVPs`.
2. Rename the first tab (bottom-left) to **`Guests`** (exact, case-sensitive).
3. In the `Guests` tab, put these headers in row 1, then one guest per row:

   | A: Name          | B: MaxPlusOnes |
   |------------------|----------------|
   | Matthew Moroney  | 1              |
   | Aunt Carol       | 0              |
   | Patty Roommate   | 2              |

   - **Name** — exactly as it should appear in the dropdown. List each invited
     adult once (kids don't need a row; count them under a parent's party size).
   - **MaxPlusOnes** — *extra* people they may bring. `0` = no +1 (party locked
     to just them), `1` = may bring one, etc.
4. You don't need to make an `RSVPs` tab — the script creates it automatically
   on the first reply, so responses stay separate from your guest list.

## 2. Add the script
1. In that spreadsheet: **Extensions → Apps Script**.
2. Delete the starter `function myFunction() {}` code.
3. Open `Code.gs` from this folder, copy **all** of it, and paste it in.
4. Click the **Save** icon (💾).

## 3. Deploy as a web app
1. Click **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" → choose **Web app**.
3. Set:
   - **Description:** `RSVP` (anything)
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**  ← important, so guests can submit
4. Click **Deploy**.
5. Click **Authorize access** and approve the permissions (it's your own
   script writing to your own sheet). If Google warns the app is
   "unverified," choose **Advanced → Go to (project) → Allow** — that's normal
   for personal Apps Scripts.
6. Copy the **Web app URL**. It ends in `/exec` — for example:
   `https://script.google.com/macros/s/AKfy.../exec`

## 4. Connect the page
1. Open `patty-and-liams-wedding.html`.
2. Near the bottom, find:
   ```js
   const SCRIPT_URL = "";
   ```
3. Paste your `/exec` URL between the quotes and save:
   ```js
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfy.../exec";
   ```

## 5. Test it
1. Open the page (locally: run `python3 -m http.server` in the repo, then visit
   <http://localhost:8000/patty-and-liams-wedding.html>; or test on the live
   site after pushing).
2. Start typing a name from your `Guests` tab — it should appear in the
   dropdown. Pick it; you'll see "✓ Found you on our list."
3. If that guest has a `MaxPlusOnes` of 1+, the "Number in your party" field
   appears with the right maximum. If it's 0, no party field shows.
4. Submit. You should see "Thank you!" and a new row in the **`RSVPs`** tab.
5. Quick cap check: try submitting a party size larger than allowed (you'd have
   to edit the page to force it) — the server replies `over_limit` and refuses.
6. Delete any test rows from the `RSVPs` tab when you're satisfied.

## Updating the script later
If you edit `Code.gs`, you must **re-deploy** for changes to take effect:
**Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.**
The `/exec` URL stays the same, so you don't need to touch `index.html` again.

## Editing the guest list later
Just edit the **`Guests`** tab — add/remove rows or change a `MaxPlusOnes`
number. Changes take effect immediately; **no re-deploy needed** (only editing
`Code.gs` requires a re-deploy). The dropdown reads the list fresh each visit.

## Good to know
- **Seat cap is enforced server-side:** the page hides/shows the +1 field as a
  convenience, but the real check is in `Code.gs` on submit — it rejects any
  party larger than that guest's `MaxPlusOnes + 1`, and rejects names that
  aren't on the list. So the cap holds even if someone edits the page.
- **Allowances stay private:** the browser is only ever sent the list of
  **names** (for the dropdown) and *its own* lookup result. Nobody can see who
  else got how many +1s.
- **Confirmed submissions (no silent data loss):** the form submits via JSONP,
  so the page reads the server's reply and shows "Thank you!" **only** when the
  row actually saved. A failure shows an error the guest can retry.
- **Spam:** a hidden honeypot field (`website`) is dropped server-side.
- **Quotas:** Apps Script's free quotas are far beyond any wedding's volume.
- **Re-deploy after editing `Code.gs`:** `Code.gs` changed (it now handles the
  guest list + cap), so you **must** push a new version:
  **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
  The `/exec` URL stays the same.
